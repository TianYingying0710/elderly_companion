"""跨端验收基座的通用支撑：HTTP、端口、子进程、临时目录与隔离扫描。

只使用 Python 标准库；不包含任何业务路由知识。
"""

from __future__ import annotations

import json as jsonlib
import os
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping

DEFAULT_HEALTH_TIMEOUT = 20.0
DEFAULT_STOP_TIMEOUT = 10.0
BODY_SNIPPET_LIMIT = 500
BACKEND_DIRS = (
    "code1-elder/backend",
    "code2-guardian/backend",
    "code3-community/backend",
)
IGNORED_PARTS = {"node_modules", ".git", "__pycache__", ".pytest_cache", ".venv", "dist"}


class StepFailure(AssertionError):
    """A failed acceptance step with enough context to locate the request."""

    def __init__(
        self,
        step: str,
        method: str,
        url: str,
        expected_status: object,
        actual_status: object,
        body: str,
        detail: str = "",
    ) -> None:
        self.step = step
        self.method = method
        self.url = url
        self.expected_status = expected_status
        self.actual_status = actual_status
        self.body = body
        self.detail = detail
        super().__init__(self._format())

    def _format(self) -> str:
        snippet = (self.body or "")[:BODY_SNIPPET_LIMIT]
        parts = [
            f"[{self.step}] {self.method} {self.url}",
            f"expected {self.expected_status}, got {self.actual_status}",
        ]
        if self.detail:
            parts.append(self.detail)
        if snippet:
            parts.append(f"body: {snippet}")
        return " | ".join(parts)


class Reporter:
    def __init__(self) -> None:
        self.checks = 0

    def passed(self, step: str, description: str) -> None:
        self.checks += 1
        print(f"PASS {step} {description}", flush=True)


class Client:
    def __init__(self, base_url: str, reporter: Reporter) -> None:
        self.base_url = base_url.rstrip("/")
        self.reporter = reporter

    def request_json(
        self,
        method: str,
        path: str,
        expected_status: int,
        *,
        step: str,
        description: str,
        json: Any = None,
        validate: Callable[[Any], None] | None = None,
    ) -> Any:
        url = f"{self.base_url}{path}"
        data = None
        headers = {"Accept": "application/json"}
        if json is not None:
            data = jsonlib.dumps(json, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                status = response.status
                body = response.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as error:
            # 先读完响应体再关闭，避免泄漏底层 socket；无论后续是否抛错都关闭。
            try:
                status = error.code
                body = error.read().decode("utf-8", errors="replace")
            finally:
                error.close()
        except urllib.error.URLError as error:
            raise StepFailure(
                step,
                method,
                url,
                expected_status,
                "connection error",
                "",
                f"connection failed: {error.reason}",
            ) from None
        if status != expected_status:
            raise StepFailure(step, method, url, expected_status, status, body)
        try:
            payload = jsonlib.loads(body)
        except jsonlib.JSONDecodeError:
            raise StepFailure(
                step,
                method,
                url,
                expected_status,
                status,
                body,
                "response is not JSON",
            ) from None
        if validate is not None:
            # 只捕获 Exception：KeyboardInterrupt / SystemExit 仍原样冒泡。
            try:
                validate(payload)
            except Exception as exc:
                raise StepFailure(
                    step,
                    method,
                    url,
                    expected_status,
                    status,
                    body,
                    f"validation failed: {exc}",
                ) from None
        self.reporter.passed(step, description)
        return payload


def allocate_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def build_env(
    base_env: Mapping[str, str],
    backend_src: Path,
    shared_src: Path,
    database_paths: Mapping[str, Path],
) -> dict[str, str]:
    env = dict(base_env)
    # 清掉父环境里其它 *_DATABASE_PATH，避免验收进程连到开发者本机数据库。
    for name in [key for key in env if key.endswith("_DATABASE_PATH")]:
        if name not in database_paths:
            del env[name]
    env.update({name: str(path) for name, path in database_paths.items()})
    # 替换而不是追加，避免开发者环境里的同名安装包遮蔽仓库源码。
    env["PYTHONPATH"] = os.pathsep.join([str(backend_src), str(shared_src)])
    return env


def snapshot_repo_databases(root: Path) -> set[Path]:
    databases: set[Path] = set()
    for relative in BACKEND_DIRS:
        backend = root / relative
        if not backend.exists():
            continue
        for path in backend.rglob("*.db"):
            if IGNORED_PARTS.intersection(path.parts):
                continue
            databases.add(path.relative_to(root))
    return databases


def create_temp_workspace(prefix: str = "silver-acceptance-") -> Path:
    return Path(tempfile.mkdtemp(prefix=prefix))


def log_tail(path: Path, limit: int = 4000) -> str:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""
    return text[-limit:]


@dataclass
class RunningService:
    name: str
    process: subprocess.Popen[bytes]
    port: int
    log_path: Path

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.port}"


def wait_for_health(
    service: RunningService, timeout: float = DEFAULT_HEALTH_TIMEOUT
) -> None:
    deadline = time.monotonic() + timeout
    url = f"{service.base_url}/health"
    while time.monotonic() < deadline:
        if service.process.poll() is not None:
            raise StepFailure(
                "STARTUP",
                "GET",
                url,
                200,
                f"exit {service.process.returncode}",
                log_tail(service.log_path),
                f"{service.name} exited before health check",
            )
        try:
            with urllib.request.urlopen(url, timeout=1.0) as response:
                body = response.read().decode("utf-8", errors="replace")
                if response.status == 200:
                    try:
                        payload = jsonlib.loads(body)
                    except jsonlib.JSONDecodeError:
                        payload = {}
                    if payload.get("status") == "ok":
                        return
        except (urllib.error.URLError, TimeoutError, OSError):
            pass
        time.sleep(0.2)
    raise StepFailure(
        "STARTUP",
        "GET",
        url,
        200,
        "timeout",
        log_tail(service.log_path),
        f"{service.name} health check timed out",
    )


def start_service(
    *,
    name: str,
    module: str,
    workdir: Path,
    backend_src: Path,
    shared_src: Path,
    python: str,
    database_paths: Mapping[str, Path],
    temp_dir: Path,
    instance: int,
) -> RunningService:
    port = allocate_port()
    env = build_env(os.environ, backend_src, shared_src, database_paths)
    log_path = temp_dir / f"{name}-{instance}.log"
    log_file = log_path.open("wb")
    try:
        process = subprocess.Popen(
            [
                python,
                "-m",
                "uvicorn",
                module,
                "--app-dir",
                str(backend_src),
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
            ],
            cwd=str(workdir),
            env=env,
            stdout=log_file,
            stderr=subprocess.STDOUT,
        )
    finally:
        log_file.close()
    service = RunningService(name, process, port, log_path)
    try:
        wait_for_health(service)
    except Exception:
        stop_service(service)
        raise
    return service


def stop_service(
    service: RunningService, timeout: float = DEFAULT_STOP_TIMEOUT
) -> None:
    process = service.process
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)
