# 跨端自动化验收基座 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增与 `verify-framework.ps1` 互不调用的 `verify-acceptance.ps1`，用真实三后端 + 临时 SQLite 跑通 22 项真实链路检查，并扩展到课程上下架的 33 项。

**Architecture:** PowerShell 入口负责解析 Python 与运行支撑层自测；Python 标准库编排器负责临时库、动态端口、子进程启停、重启与汇总；`scenarios.py` 只通过 HTTP 客户端和显式状态表达业务流，不感知进程、端口或环境变量。

**Tech Stack:** Windows PowerShell、Python 3.12 标准库、既有 `uvicorn`/FastAPI、SQLite（后端按已授权例外建表）。

**Spec:** `docs/superpowers/specs/2026-11-14-cross-end-acceptance-design.md`

## Global Constraints

- 禁止安装任何依赖；验收只使用 Python 标准库、PowerShell 内建能力和仓库已有 npm 脚本。
- 不修改 `scripts/verify-framework.ps1`、业务代码、HTTP 契约、后端测试或前端测试；验收只新增文件。
- 不在仓库内创建数据库、日志或临时文件；所有运行产物放在 `tempfile.mkdtemp(prefix='silver-acceptance-')`，`finally` 中删除。
- 不占用 `8001/8002/8003`；只绑定 `127.0.0.1` 动态空闲端口。
- 不 import 任何 `silver_companion_*` 后端内部模块；不直接连接 SQLite；不引用表名、列名或 schema。
- 不依赖演示预置课程 id 或固定 `elder-001`；所有验收数据带本次 `run-id`（`acceptance-<hex>`）和「自动化验收」标记，不含真实个人信息。
- 业务请求不自动重试；任一断言失败立即停止并返回退出码 `1`。
- 提交只含本任务新增/修改的文件；禁止 force push；推送由用户执行。
- 测试在 `E:\c2--\code` 运行；Python 使用 `E:\workspace\silver-companion-env\python.exe`。

---

### Task 1: 支撑层 `support.py` 与单元测试

**Files:**
- Create: `scripts/acceptance/support.py`
- Test: `scripts/acceptance/tests/test_support.py`

**Interfaces:**
- Produces:
  - `StepFailure(AssertionError)`，构造参数 `(step, method, url, expected_status, actual_status, body, detail="")`，`__str__` 含步骤、方法、URL、期望/实际状态与响应摘要。
  - `Reporter`，属性 `checks: int`，方法 `passed(step: str, description: str) -> None`，输出 `PASS <step> <description>` 并递增。
  - `Client(base_url: str, reporter: Reporter)`，方法 `request_json(method, path, expected_status, *, step, description, json=None, validate=None) -> Any`；状态匹配且 `validate` 通过后才记一次 PASS。
  - `allocate_port() -> int`。
  - `build_env(base_env, backend_src, shared_src, database_paths) -> dict[str, str]`。
  - `snapshot_repo_databases(root: Path) -> set[Path]`。
  - `create_temp_workspace() -> Path`。
  - `start_service(*, name, module, workdir, backend_src, shared_src, python, database_paths, temp_dir, instance) -> RunningService`。
  - `stop_service(service, timeout=10.0) -> None`。
  - `log_tail(path: Path, limit: int = 4000) -> str`。

- [ ] **Step 1: 写失败测试**

创建 `scripts/acceptance/tests/test_support.py`：

```python
from __future__ import annotations

import json
import os
import socket
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import support


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        self._respond()

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        self.server.last_body = self.rfile.read(length).decode("utf-8")  # type: ignore[attr-defined]
        self._respond()

    def _respond(self) -> None:
        if self.path == "/ok":
            self._send(200, {"status": "ok"})
        elif self.path == "/created":
            self._send(201, {"id": "created"})
        elif self.path == "/conflict":
            self._send(409, {"error": {"code": "conflict"}})
        elif self.path == "/unavailable":
            self._send(503, {"error": {"code": "unavailable"}})
        elif self.path == "/wrong":
            self._send(500, {"error": {"code": "boom"}})
        elif self.path == "/text":
            self._send_raw(200, b"plain text", "text/plain")
        elif self.path == "/echo":
            body = getattr(self.server, "last_body", "")
            self._send(200, {"method": self.command, "body": body})
        else:
            self._send(404, {"error": {"code": "not_found"}})

    def _send(self, status: int, payload: object) -> None:
        self._send_raw(status, json.dumps(payload).encode("utf-8"), "application/json")

    def _send_raw(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args: object) -> None:
        return


class SupportTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def _client(self) -> tuple[support.Client, support.Reporter]:
        reporter = support.Reporter()
        return support.Client(self.base_url, reporter), reporter

    def test_allocate_port_can_be_rebound(self) -> None:
        port = support.allocate_port()
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", port))

    def test_build_env_overrides_database_paths_without_mutating_parent(self) -> None:
        parent = {
            "ELDER_DATABASE_PATH": "real-elder.db",
            "SOS_DATABASE_PATH": "real-sos.db",
            "COMMUNITY_DATABASE_PATH": "real-community.db",
            "PATH": "keep",
        }
        databases = {
            "ELDER_DATABASE_PATH": Path("tmp/elder.db"),
            "SOS_DATABASE_PATH": Path("tmp/sos.db"),
            "COMMUNITY_DATABASE_PATH": Path("tmp/community.db"),
        }
        env = support.build_env(
            parent, Path("backend/src"), Path("shared/src"), databases
        )
        self.assertEqual(env["ELDER_DATABASE_PATH"], str(Path("tmp/elder.db")))
        self.assertEqual(env["SOS_DATABASE_PATH"], str(Path("tmp/sos.db")))
        self.assertEqual(env["COMMUNITY_DATABASE_PATH"], str(Path("tmp/community.db")))
        self.assertEqual(env["PATH"], "keep")
        self.assertEqual(parent["ELDER_DATABASE_PATH"], "real-elder.db")

    def test_build_env_places_backend_and_shared_on_pythonpath(self) -> None:
        env = support.build_env(
            {"PATH": "keep"},
            Path("backend/src"),
            Path("shared/src"),
            {"ELDER_DATABASE_PATH": Path("tmp/elder.db")},
        )
        parts = env["PYTHONPATH"].split(os.pathsep)
        self.assertEqual(parts[0], str(Path("backend/src")))
        self.assertIn(str(Path("shared/src")), parts)

    def test_snapshot_repo_databases_ignores_vendor_directories(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            for relative in (
                "code1-elder/backend/data/a.db",
                "code1-elder/backend/node_modules/x.db",
                "code1-elder/backend/.git/y.db",
                "code2-guardian/backend/b.db",
            ):
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b"x")
            found = support.snapshot_repo_databases(root)
            self.assertEqual(
                found,
                {
                    Path("code1-elder/backend/data/a.db"),
                    Path("code2-guardian/backend/b.db"),
                },
            )

    def test_request_json_returns_body_and_counts_check(self) -> None:
        client, reporter = self._client()
        payload = client.request_json(
            "GET", "/ok", 200, step="S99", description="ok"
        )
        self.assertEqual(payload, {"status": "ok"})
        self.assertEqual(reporter.checks, 1)

    def test_request_json_sends_json_post_body(self) -> None:
        client, _ = self._client()
        payload = client.request_json(
            "POST",
            "/echo",
            200,
            step="S98",
            description="echo",
            json={"a": 1},
        )
        self.assertEqual(payload["method"], "POST")
        self.assertEqual(json.loads(payload["body"]), {"a": 1})

    def test_request_json_accepts_409_and_503(self) -> None:
        client, reporter = self._client()
        conflict = client.request_json(
            "GET", "/conflict", 409, step="S97", description="conflict"
        )
        unavailable = client.request_json(
            "GET", "/unavailable", 503, step="S96", description="unavailable"
        )
        self.assertEqual(conflict["error"]["code"], "conflict")
        self.assertEqual(unavailable["error"]["code"], "unavailable")
        self.assertEqual(reporter.checks, 2)

    def test_request_json_reports_status_mismatch(self) -> None:
        client, reporter = self._client()
        with self.assertRaises(support.StepFailure) as raised:
            client.request_json("GET", "/wrong", 200, step="S95", description="wrong")
        message = str(raised.exception)
        self.assertIn("[S95]", message)
        self.assertIn("GET", message)
        self.assertIn("expected 200, got 500", message)
        self.assertIn("boom", message)
        self.assertEqual(reporter.checks, 0)

    def test_request_json_reports_non_json_body(self) -> None:
        client, _ = self._client()
        with self.assertRaises(support.StepFailure) as raised:
            client.request_json("GET", "/text", 200, step="S94", description="text")
        self.assertIn("response is not JSON", str(raised.exception))

    def test_step_failure_message_contains_context(self) -> None:
        failure = support.StepFailure(
            "S04e",
            "POST",
            "http://127.0.0.1/courses/x/publication",
            409,
            200,
            '{"error":{"code":"illegal_course_publication"}}',
        )
        message = str(failure)
        self.assertIn("[S04e]", message)
        self.assertIn("POST", message)
        self.assertIn("http://127.0.0.1/courses/x/publication", message)
        self.assertIn("expected 409, got 200", message)
        self.assertIn("illegal_course_publication", message)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
& "E:\workspace\silver-companion-env\python.exe" -m unittest discover -s "E:\c2--\code\scripts\acceptance\tests" -p "test_support.py" -v
```

Expected: FAIL，`ModuleNotFoundError: No module named 'support'`。

- [ ] **Step 3: 实现支撑层**

创建 `scripts/acceptance/support.py`：

```python
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
            status = error.code
            body = error.read().decode("utf-8", errors="replace")
        except urllib.error.URLError as error:
            raise StepFailure(
                step,
                method,
                url,
                expected_status,
                "connection error",
                "",
                str(error.reason),
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
            validate(payload)
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
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```powershell
& "E:\workspace\silver-companion-env\python.exe" -m unittest discover -s "E:\c2--\code\scripts\acceptance\tests" -p "test_support.py" -v
```

Expected: `Ran 10 tests ... OK`。

- [ ] **Step 5: 提交**

```powershell
git add scripts/acceptance/support.py scripts/acceptance/tests/test_support.py
git commit -m "test(acceptance): add harness support layer"
```

---

### Task 2: 场景层、编排器与 22 项真实链路验收

**Files:**
- Create: `scripts/acceptance/scenarios.py`
- Create: `scripts/acceptance/run_acceptance.py`
- Create: `scripts/verify-acceptance.ps1`
- Create: `scripts/tests/test-verify-acceptance.ps1`

**Interfaces:**
- Consumes: Task 1 的 `support.Client`、`support.Reporter`、`support.start_service`、`support.stop_service`、`support.snapshot_repo_databases`、`support.create_temp_workspace`。
- Produces:
  - `scenarios.ElderState(elder_id, course_id, sos_id)`、`scenarios.CommunityState(task_id)`。
  - `scenarios.run_elder_checks(client, run_id) -> ElderState`（S01–S09）。
  - `scenarios.run_guardian_checks(client, run_id) -> None`（S10–S11）。
  - `scenarios.run_community_checks(client, run_id) -> CommunityState`（S12–S16）。
  - `scenarios.run_elder_restart_checks(client, state) -> None`（S17–S19）。
  - `scenarios.run_community_restart_checks(client, state) -> None`（S20）。
  - CLI：`python scripts/acceptance/run_acceptance.py --python <python.exe> --root <repo-root>`，成功输出 `ACCEPTANCE PASS (22 checks)`。

- [ ] **Step 1: 写场景层**

创建 `scripts/acceptance/scenarios.py`：

```python
"""跨端验收业务流：只依赖 HTTP 客户端与显式状态。

不启动进程、不读环境变量、不知道端口或临时目录。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

from support import Client

SCHEDULED_AT = "2026-11-14T06:30:00+00:00"
SERVICE_NOTE = "自动化验收服务记录"


@dataclass(frozen=True)
class ElderState:
    elder_id: str
    course_id: str
    sos_id: str


@dataclass(frozen=True)
class CommunityState:
    task_id: str


def _path_id(value: str) -> str:
    return quote(value, safe="")


def _check(step: str, condition: bool, message: str, payload: Any) -> None:
    if not condition:
        raise AssertionError(f"[{step}] {message}: {payload!r}")


def run_elder_checks(client: Client, run_id: str) -> ElderState:
    client.request_json(
        "GET",
        "/health",
        200,
        step="S01",
        description="elder /health",
        validate=lambda payload: _check(
            "S01", payload.get("status") == "ok", "status is not ok", payload
        ),
    )

    def validate_catalog(catalog: Any) -> None:
        _check("S02", isinstance(catalog, list), "catalog is not a list", catalog)
        for course in catalog:
            for field in ("id", "title", "category", "duration_seconds"):
                _check("S02", field in course, f"course missing {field}", course)

    client.request_json(
        "GET",
        "/api/v1/courses",
        200,
        step="S02",
        description="elder course catalog",
        validate=validate_catalog,
    )

    def validate_created(course: Any) -> None:
        _check("S03", course["id"].startswith("course-"), "unexpected course id", course)
        _check(
            "S03",
            course["title"] == f"自动化验收课程 {run_id}",
            "title mismatch",
            course,
        )
        _check("S03", course["outline"] == ["第一步", "第二步"], "outline mismatch", course)
        _check("S03", course["status"] == "published", "new course is not published", course)
        _check("S03", course["editable"] is True, "new course is not editable", course)

    created = client.request_json(
        "POST",
        "/api/v1/courses",
        201,
        step="S03",
        description="create course",
        json={
            "title": f"自动化验收课程 {run_id}",
            "category": "自动化验收",
            "description": "自动化验收创建的课程，不含真实个人信息",
            "duration_seconds": 60,
            "outline": ["第一步", "第二步"],
        },
        validate=validate_created,
    )
    course_id = created["id"]

    def validate_record(record: Any) -> None:
        _check("S04", record["course_id"] == course_id, "course id mismatch", record)
        _check("S04", record["progress_percent"] == 42, "progress mismatch", record)

    client.request_json(
        "PUT",
        f"/api/v1/learning-records/{_path_id(course_id)}",
        200,
        step="S04",
        description="write learning progress 42",
        json={"progress_percent": 42},
        validate=validate_record,
    )

    def validate_sos(event: Any) -> None:
        _check("S05", event["status"] == "pending", "status is not pending", event)
        _check("S05", event["note"] == "自动化验收求助", "note mismatch", event)

    sos = client.request_json(
        "POST",
        "/api/v1/sos-events",
        201,
        step="S05",
        description="create SOS event",
        json={"elder_id": run_id, "note": "自动化验收求助"},
        validate=validate_sos,
    )
    sos_id = sos["id"]

    def validate_events(events: Any) -> None:
        _check("S06", isinstance(events, list), "events is not a list", events)
        _check(
            "S06",
            any(event["id"] == sos_id for event in events),
            "created event missing",
            events,
        )

    client.request_json(
        "GET",
        f"/api/v1/sos-events?elder_id={quote(run_id, safe='')}",
        200,
        step="S06",
        description="list SOS by elder_id",
        validate=validate_events,
    )

    client.request_json(
        "PATCH",
        f"/api/v1/sos-events/{_path_id(sos_id)}",
        200,
        step="S07",
        description="SOS pending -> processing",
        json={"status": "processing"},
        validate=lambda payload: _check(
            "S07", payload["status"] == "processing", "status mismatch", payload
        ),
    )

    client.request_json(
        "PATCH",
        f"/api/v1/sos-events/{_path_id(sos_id)}",
        409,
        step="S08",
        description="SOS regression rejected",
        json={"status": "pending"},
        validate=lambda payload: _check(
            "S08",
            payload["error"]["code"] == "illegal_sos_status_transition",
            "unexpected error code",
            payload,
        ),
    )

    client.request_json(
        "POST",
        f"/api/v1/sos-events/{_path_id(sos_id)}/transitions",
        200,
        step="S09",
        description="SOS processing -> resolved via POST alias",
        json={"status": "resolved"},
        validate=lambda payload: _check(
            "S09", payload["status"] == "resolved", "status mismatch", payload
        ),
    )

    return ElderState(run_id, course_id, sos_id)


def run_guardian_checks(client: Client, run_id: str) -> None:
    client.request_json(
        "GET",
        "/health",
        200,
        step="S10",
        description="guardian /health",
        validate=lambda payload: _check(
            "S10", payload.get("status") == "ok", "status is not ok", payload
        ),
    )
    client.request_json(
        "GET",
        f"/api/v1/health-overview/{quote(run_id, safe='')}",
        503,
        step="S11",
        description="guardian health source honestly unavailable",
        validate=lambda payload: _check(
            "S11",
            payload["error"]["code"] == "health_data_source_unavailable",
            "unexpected error code",
            payload,
        ),
    )


def run_community_checks(client: Client, run_id: str) -> CommunityState:
    client.request_json(
        "GET",
        "/health",
        200,
        step="S12",
        description="community /health",
        validate=lambda payload: _check(
            "S12", payload.get("status") == "ok", "status is not ok", payload
        ),
    )
    created = client.request_json(
        "POST",
        "/api/v1/service-tasks",
        201,
        step="S13",
        description="create service task",
        json={
            "title": f"自动化验收服务 {run_id}",
            "elder_name": "自动化验收老人",
            "category": "自动化验收",
            "scheduled_at": SCHEDULED_AT,
            "location": "自动化验收地点",
            "description": "自动化验收创建的服务任务，不含真实个人信息",
        },
        validate=lambda payload: _check(
            "S13", payload["status"] == "pending", "status mismatch", payload
        ),
    )
    task_id = created["id"]
    client.request_json(
        "POST",
        f"/api/v1/service-tasks/{_path_id(task_id)}/accept",
        200,
        step="S14",
        description="accept service task",
        validate=lambda payload: _check(
            "S14", payload["status"] == "in_service", "status mismatch", payload
        ),
    )
    client.request_json(
        "POST",
        f"/api/v1/service-tasks/{_path_id(task_id)}/complete",
        200,
        step="S15",
        description="complete service task",
        json={"note": SERVICE_NOTE},
        validate=lambda payload: _check(
            "S15",
            payload["status"] == "completed" and payload["note"] == SERVICE_NOTE,
            "completed state or note mismatch",
            payload,
        ),
    )
    client.request_json(
        "POST",
        f"/api/v1/service-tasks/{_path_id(task_id)}/complete",
        409,
        step="S16",
        description="repeat completion rejected",
        json={"note": SERVICE_NOTE},
        validate=lambda payload: _check(
            "S16",
            payload["error"]["code"] == "invalid_state_transition",
            "unexpected error code",
            payload,
        ),
    )
    return CommunityState(task_id)


def run_elder_restart_checks(client: Client, state: ElderState) -> None:
    client.request_json(
        "GET",
        f"/api/v1/sos-events?elder_id={quote(state.elder_id, safe='')}",
        200,
        step="S17",
        description="SOS survived elder restart",
        validate=lambda events: _check(
            "S17",
            any(
                event["id"] == state.sos_id and event["status"] == "resolved"
                for event in events
            ),
            "resolved event missing after restart",
            events,
        ),
    )
    client.request_json(
        "GET",
        "/api/v1/courses",
        200,
        step="S18",
        description="course survived elder restart",
        validate=lambda catalog: _check(
            "S18",
            any(course["id"] == state.course_id for course in catalog),
            "created course missing after restart",
            catalog,
        ),
    )
    client.request_json(
        "GET",
        "/api/v1/learning-records",
        200,
        step="S19",
        description="learning progress survived elder restart",
        validate=lambda records: _check(
            "S19",
            any(
                record["course_id"] == state.course_id
                and record["progress_percent"] == 42
                for record in records
            ),
            "progress 42 missing after restart",
            records,
        ),
    )


def run_community_restart_checks(client: Client, state: CommunityState) -> None:
    client.request_json(
        "GET",
        f"/api/v1/service-tasks/{_path_id(state.task_id)}",
        200,
        step="S20",
        description="service task survived community restart",
        validate=lambda task: _check(
            "S20",
            task["status"] == "completed" and task["note"] == SERVICE_NOTE,
            "completed state or note mismatch after restart",
            task,
        ),
    )
```

- [ ] **Step 2: 写编排器**

创建 `scripts/acceptance/run_acceptance.py`：

```python
"""跨端验收 CLI：临时库、动态端口、三后端启停、重启与汇总。"""

from __future__ import annotations

import argparse
import shutil
import sys
import traceback
from dataclasses import dataclass
from pathlib import Path
from secrets import token_hex
from typing import Mapping

import scenarios
import support

SHARED_SRC = "code4-shared/src"


@dataclass(frozen=True)
class ServiceSpec:
    name: str
    module: str
    src: str
    workdir: str
    databases: tuple[tuple[str, str], ...]


SERVICE_SPECS = (
    ServiceSpec(
        "elder",
        "silver_companion_elder.main:app",
        "code1-elder/backend/src",
        "code1-elder/backend",
        (
            ("ELDER_DATABASE_PATH", "elder.db"),
            ("SOS_DATABASE_PATH", "sos.db"),
        ),
    ),
    ServiceSpec(
        "guardian",
        "silver_companion_guardian.main:app",
        "code2-guardian/backend/src",
        "code2-guardian/backend",
        (),
    ),
    ServiceSpec(
        "community",
        "silver_companion_community.main:app",
        "code3-community/backend/src",
        "code3-community/backend",
        (("COMMUNITY_DATABASE_PATH", "community.db"),),
    ),
)

ALL_DATABASE_FILES: dict[str, str] = {}
for _spec in SERVICE_SPECS:
    ALL_DATABASE_FILES.update(dict(_spec.databases))


def _spec(name: str) -> ServiceSpec:
    return next(spec for spec in SERVICE_SPECS if spec.name == name)


def _start(
    spec: ServiceSpec,
    root: Path,
    python: str,
    database_paths: Mapping[str, Path],
    temp_dir: Path,
    instance: int,
) -> support.RunningService:
    return support.start_service(
        name=spec.name,
        module=spec.module,
        workdir=root / spec.workdir,
        backend_src=root / spec.src,
        shared_src=root / SHARED_SRC,
        python=python,
        database_paths=database_paths,
        temp_dir=temp_dir,
        instance=instance,
    )


def _check_isolation(
    root: Path,
    database_paths: Mapping[str, Path],
    baseline: set[Path],
    reporter: support.Reporter,
) -> None:
    for env_name, path in database_paths.items():
        if not path.exists() or path.stat().st_size == 0:
            raise AssertionError(
                f"[G02] temp database missing or empty: {env_name} -> {path}"
            )
    added = support.snapshot_repo_databases(root) - baseline
    if added:
        raise AssertionError(
            f"[G02] new repository database files: {sorted(str(path) for path in added)}"
        )
    reporter.passed("G02", "temp databases non-empty; repository has no new databases")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Cross-end acceptance harness")
    parser.add_argument("--python", required=True)
    parser.add_argument("--root", required=True)
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    python = str(Path(args.python).resolve())
    if not Path(python).is_file():
        parser.error(f"Python executable not found: {python}")
    if not (root / "code1-elder").is_dir():
        parser.error(f"Repository root not found: {root}")

    reporter = support.Reporter()
    temp_dir = support.create_temp_workspace()
    database_paths = {
        name: temp_dir / filename for name, filename in ALL_DATABASE_FILES.items()
    }
    baseline = support.snapshot_repo_databases(root)
    services: dict[str, support.RunningService] = {}
    try:
        reporter.passed("G01", "repository database baseline captured")

        for spec in SERVICE_SPECS:
            services[spec.name] = _start(spec, root, python, database_paths, temp_dir, 1)

        run_id = f"acceptance-{token_hex(4)}"
        elder_state = scenarios.run_elder_checks(
            support.Client(services["elder"].base_url, reporter), run_id
        )
        scenarios.run_guardian_checks(
            support.Client(services["guardian"].base_url, reporter), run_id
        )
        community_state = scenarios.run_community_checks(
            support.Client(services["community"].base_url, reporter), run_id
        )

        support.stop_service(services["elder"])
        services["elder"] = _start(
            _spec("elder"), root, python, database_paths, temp_dir, 2
        )
        scenarios.run_elder_restart_checks(
            support.Client(services["elder"].base_url, reporter), elder_state
        )

        support.stop_service(services["community"])
        services["community"] = _start(
            _spec("community"), root, python, database_paths, temp_dir, 2
        )
        scenarios.run_community_restart_checks(
            support.Client(services["community"].base_url, reporter), community_state
        )

        _check_isolation(root, database_paths, baseline, reporter)
        print(f"ACCEPTANCE PASS ({reporter.checks} checks)", flush=True)
        return 0
    except AssertionError as error:
        print(str(error), file=sys.stderr, flush=True)
        return 1
    except Exception:
        traceback.print_exc()
        return 1
    finally:
        for service in services.values():
            support.stop_service(service)
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 3: 写 PowerShell 入口**

创建 `scripts/verify-acceptance.ps1`：

```powershell
param(
    [string]$Python
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'resolve-python.ps1')
$Python = Resolve-SilverCompanionPython -ExplicitPython $Python

& $Python -m unittest discover -s (Join-Path $root 'scripts\acceptance\tests') -p 'test_support.py'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $root 'scripts\acceptance\run_acceptance.py') --python $Python --root $root
exit $LASTEXITCODE
```

- [ ] **Step 4: 写入口接线测试**

创建 `scripts/tests/test-verify-acceptance.ps1`：

```powershell
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$verifyScript = Join-Path $root 'scripts\verify-acceptance.ps1'
$testRoot = Join-Path $PSScriptRoot '.tmp-verify-acceptance'
$fakePython = Join-Path $testRoot 'python.cmd'
$logFile = Join-Path $testRoot 'invocations.txt'
$originalLogFile = $env:VERIFY_ACCEPTANCE_TEST_LOG

try {
    New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
    Set-Content -LiteralPath $fakePython -Encoding ASCII -Value @(
        '@echo off',
        '>>"%VERIFY_ACCEPTANCE_TEST_LOG%" echo %*',
        'exit /b 0'
    )
    $env:VERIFY_ACCEPTANCE_TEST_LOG = $logFile

    & $verifyScript -Python $fakePython
    if ($LASTEXITCODE -ne 0) {
        throw "verify-acceptance.ps1 returned exit code $LASTEXITCODE"
    }

    $lines = @(Get-Content -LiteralPath $logFile)
    if ($lines.Count -ne 2) {
        throw "Expected 2 Python invocations, got $($lines.Count)."
    }
    if ($lines[0] -notmatch '-m unittest discover') {
        throw "First invocation is not the support self-test: $($lines[0])"
    }
    if ($lines[1] -notmatch 'run_acceptance\.py') {
        throw "Second invocation is not the orchestrator: $($lines[1])"
    }
    if ($lines[1] -notmatch [regex]::Escape("--python $fakePython")) {
        throw "Orchestrator did not receive the resolved Python path: $($lines[1])"
    }
    if ($lines[1] -notmatch [regex]::Escape("--root $root")) {
        throw "Orchestrator did not receive the repository root: $($lines[1])"
    }

    $content = Get-Content -LiteralPath $verifyScript -Raw
    if ($content -match 'verify-framework') {
        throw 'verify-acceptance.ps1 must not call verify-framework.ps1'
    }
    if ($content -match '(?i)pip\s+install|npm\s+(install|i)\b') {
        throw 'verify-acceptance.ps1 must not install dependencies'
    }

    Write-Output 'verify acceptance wiring tests passed'
}
finally {
    $env:VERIFY_ACCEPTANCE_TEST_LOG = $originalLogFile
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
```

- [ ] **Step 5: 运行接线测试**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "E:\c2--\code\scripts\tests\test-verify-acceptance.ps1"
```

Expected: `verify acceptance wiring tests passed`，退出码 0。

- [ ] **Step 6: 运行 22 项验收**

Run:

```powershell
.\scripts\verify-acceptance.ps1 -Python "E:\workspace\silver-companion-env\python.exe"
```

Expected: 逐行 `PASS G01 ...`、`PASS S01 ...` 到 `PASS S20 ...`、`PASS G02 ...`，末尾 `ACCEPTANCE PASS (22 checks)`，退出码 0。若失败，按输出的步骤号、URL、期望/实际状态和后端日志尾部定位；不要通过放宽断言或删除检查来绕过。

- [ ] **Step 7: 提交**

```powershell
git add scripts/acceptance/scenarios.py scripts/acceptance/run_acceptance.py scripts/verify-acceptance.ps1 scripts/tests/test-verify-acceptance.ps1
git commit -m "feat(acceptance): run real backends against temporary databases"
```

---

### Task 3: 课程上下架验收扩展（22 → 33 项）

**Files:**
- Modify: `docs/superpowers/specs/2026-11-14-cross-end-acceptance-design.md`
- Modify: `scripts/acceptance/scenarios.py`

**Interfaces:**
- Consumes: Task 2 的 `run_elder_checks`、`run_elder_restart_checks`、`Client.request_json`。
- Produces: `run_course_publication_checks(client, course_id) -> None`（S04a–S04f）；`run_course_publication_restart_checks(client, course_id) -> None`（S18a–S18e）；总检查数 33。

- [ ] **Step 1: 更新验收规格**

在 `docs/superpowers/specs/2026-11-14-cross-end-acceptance-design.md` 的场景表中：

1. 在 S04 后插入：

```markdown
| S04a | elder | `POST /api/v1/courses/{course_id}/publication` `{"status":"unpublished"}` | 200，`status=unpublished` |
| S04b | elder | `GET /api/v1/courses` | 200，不含 S03 课程 |
| S04c | elder | `GET /api/v1/courses?include_unpublished=true` | 200，含且仅含 1 条 S03 课程，`status=unpublished`、`editable=true` |
| S04d | elder | `GET /api/v1/courses/{course_id}` | 404，`error.code=course_not_found` |
| S04e | elder | 再次 `POST .../publication` `{"status":"unpublished"}` | 409，`error.code=illegal_course_publication` |
| S04f | elder | `POST /api/v1/courses/acceptance-ghost/publication` `{"status":"unpublished"}` | 404，`error.code=course_not_found` |
```

2. 把 S18 改为：

```markdown
| S18 | elder 重启 | `GET /api/v1/courses?include_unpublished=true` | S03 课程仍为 1 条且 `status=unpublished` |
```

3. 在 S18 后插入：

```markdown
| S18a | elder 重启 | `GET /api/v1/courses` | 200，不含 S03 课程 |
| S18b | elder 重启 | `GET /api/v1/courses/{course_id}` | 404，`error.code=course_not_found` |
| S18c | elder 重启 | `POST .../publication` `{"status":"published"}` | 200，`status=published` |
| S18d | elder 重启 | `GET /api/v1/courses` | 200，重新包含 S03 课程 |
| S18e | elder 重启 | `GET /api/v1/courses/{course_id}` | 200，`status=published`、`editable=true` |
```

4. 把“总计 22 项检查”改为“总计 33 项检查”，并在该段说明：S04a–S04f 与 S18a–S18e 使用 S03 创建的动态课程，不读取预置课程 id；S19 继续验证学习记录在下架与重启后仍为 42。

- [ ] **Step 2: 扩展场景层**

在 `scripts/acceptance/scenarios.py` 中新增两个函数：

```python
def run_course_publication_checks(client: Client, course_id: str) -> None:
    client.request_json(
        "POST",
        f"/api/v1/courses/{_path_id(course_id)}/publication",
        200,
        step="S04a",
        description="unpublish created course",
        json={"status": "unpublished"},
        validate=lambda course: _check(
            "S04a", course["status"] == "unpublished", "status mismatch", course
        ),
    )
    client.request_json(
        "GET",
        "/api/v1/courses",
        200,
        step="S04b",
        description="catalog hides unpublished course",
        validate=lambda catalog: _check(
            "S04b",
            all(course["id"] != course_id for course in catalog),
            "unpublished course still visible",
            catalog,
        ),
    )

    def validate_hidden(catalog: Any) -> None:
        hidden = [course for course in catalog if course["id"] == course_id]
        _check("S04c", len(hidden) == 1, "hidden course missing or duplicated", catalog)
        _check(
            "S04c",
            hidden[0]["status"] == "unpublished",
            "hidden course status mismatch",
            hidden[0],
        )
        _check(
            "S04c", hidden[0]["editable"] is True, "course is not editable", hidden[0]
        )

    client.request_json(
        "GET",
        "/api/v1/courses?include_unpublished=true",
        200,
        step="S04c",
        description="include_unpublished returns hidden course",
        validate=validate_hidden,
    )
    client.request_json(
        "GET",
        f"/api/v1/courses/{_path_id(course_id)}",
        404,
        step="S04d",
        description="unpublished course detail is not found",
        validate=lambda payload: _check(
            "S04d",
            payload["error"]["code"] == "course_not_found",
            "unexpected error code",
            payload,
        ),
    )
    client.request_json(
        "POST",
        f"/api/v1/courses/{_path_id(course_id)}/publication",
        409,
        step="S04e",
        description="same publication target rejected",
        json={"status": "unpublished"},
        validate=lambda payload: _check(
            "S04e",
            payload["error"]["code"] == "illegal_course_publication",
            "unexpected error code",
            payload,
        ),
    )
    client.request_json(
        "POST",
        "/api/v1/courses/acceptance-ghost/publication",
        404,
        step="S04f",
        description="unknown course publication rejected",
        json={"status": "unpublished"},
        validate=lambda payload: _check(
            "S04f",
            payload["error"]["code"] == "course_not_found",
            "unexpected error code",
            payload,
        ),
    )


def run_course_publication_restart_checks(client: Client, course_id: str) -> None:
    client.request_json(
        "GET",
        "/api/v1/courses",
        200,
        step="S18a",
        description="unpublished course still hidden after restart",
        validate=lambda catalog: _check(
            "S18a",
            all(course["id"] != course_id for course in catalog),
            "unpublished course visible after restart",
            catalog,
        ),
    )
    client.request_json(
        "GET",
        f"/api/v1/courses/{_path_id(course_id)}",
        404,
        step="S18b",
        description="unpublished detail still hidden after restart",
        validate=lambda payload: _check(
            "S18b",
            payload["error"]["code"] == "course_not_found",
            "unexpected error code",
            payload,
        ),
    )
    client.request_json(
        "POST",
        f"/api/v1/courses/{_path_id(course_id)}/publication",
        200,
        step="S18c",
        description="republish after restart",
        json={"status": "published"},
        validate=lambda course: _check(
            "S18c", course["status"] == "published", "status mismatch", course
        ),
    )
    client.request_json(
        "GET",
        "/api/v1/courses",
        200,
        step="S18d",
        description="republished course returns to catalog",
        validate=lambda catalog: _check(
            "S18d",
            any(course["id"] == course_id for course in catalog),
            "republished course missing from catalog",
            catalog,
        ),
    )

    def validate_detail(course: Any) -> None:
        _check("S18e", course["status"] == "published", "status mismatch", course)
        _check("S18e", course["editable"] is True, "course is not editable", course)

    client.request_json(
        "GET",
        f"/api/v1/courses/{_path_id(course_id)}",
        200,
        step="S18e",
        description="republished detail available",
        validate=validate_detail,
    )
```

- [ ] **Step 3: 接入场景顺序**

在 `run_elder_checks` 的 S04 之后、S05 之前加入：

```python
    run_course_publication_checks(client, course_id)
```

把 `run_elder_restart_checks` 中的 S18 改为 `include_unpublished=true`，并在 S18 之后、S19 之前加入：

```python
    client.request_json(
        "GET",
        "/api/v1/courses?include_unpublished=true",
        200,
        step="S18",
        description="unpublished course survived elder restart",
        validate=lambda catalog: _check(
            "S18",
            len([course for course in catalog if course["id"] == state.course_id]) == 1
            and [
                course
                for course in catalog
                if course["id"] == state.course_id
            ][0]["status"]
            == "unpublished",
            "unpublished course missing or changed after restart",
            catalog,
        ),
    )
    run_course_publication_restart_checks(client, state.course_id)
```

删除原 S18 的 `GET /api/v1/courses` 断言，避免下架后必然失败。S19 保持在学习记录上。

- [ ] **Step 4: 运行验收确认 33 项通过**

Run:

```powershell
.\scripts\verify-acceptance.ps1 -Python "E:\workspace\silver-companion-env\python.exe"
```

Expected: 输出包含 `PASS S04a` 到 `PASS S04f`、`PASS S18a` 到 `PASS S18e`，末尾 `ACCEPTANCE PASS (33 checks)`，退出码 0。

- [ ] **Step 5: 故障路径确认一次**

把 S04e 的期望状态临时从 `409` 改为 `200`，运行同一命令。

Expected: 退出码 1，stderr 含 `[S04e]`、`POST`、`/publication`、`expected 200, got 409`，且不出现 `ACCEPTANCE PASS`。

随后把 `409` 改回并重跑，确认重新 `ACCEPTANCE PASS (33 checks)`。

- [ ] **Step 6: 提交**

```powershell
git add docs/superpowers/specs/2026-11-14-cross-end-acceptance-design.md scripts/acceptance/scenarios.py
git commit -m "test(acceptance): cover course publication and restart persistence"
```

---

### Task 4: 文档、双门禁与全量验证

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/architecture.md`
- Modify: `docs/progress.md`
- Modify: `HANDOVER.md`

**Interfaces:**
- Consumes: Task 3 的 33 项验收结果与 Task 2 的入口命令。
- Produces: 双门禁文档、进度与交接更新。

- [ ] **Step 1: 更新 README 验证章节**

把 `README.md` 的验证代码块替换为：

```powershell
# 门禁 1：三端测试与构建
.\scripts\verify-framework.ps1 -Python "E:\workspace\silver-companion-env\python.exe"
# 外部 Android 工具和 Gradle 分发包可用时：
.\scripts\verify-framework.ps1 -Python "E:\workspace\silver-companion-env\python.exe" -IncludeAndroid

# 门禁 2：真实三后端 + 临时库 + 重启持久化
.\scripts\verify-acceptance.ps1 -Python "E:\workspace\silver-companion-env\python.exe"
```

在代码块后加入：

```markdown
两条命令互不调用，均成功才算发布通过。验收只使用 `127.0.0.1` 动态端口和系统临时目录，不读写开发者数据库，也不依赖演示预置数据；任一步失败立即停止并输出步骤号、方法、URL、期望/实际状态与响应摘要。
```

- [ ] **Step 2: 更新 AGENTS 验证命令**

在 `AGENTS.md` 的“验证命令”代码块后加入：

```powershell
.\scripts\verify-acceptance.ps1 -Python "<银龄伴 Python 可执行文件>"
```

并在同一节加入：

```markdown
发布门禁由两条互不调用的命令组成：`verify-framework.ps1` 与 `verify-acceptance.ps1` 均成功才算通过。后者启动真实三后端并使用临时 SQLite 库，不读写开发者数据库；它不修改也不调用 `verify-framework.ps1`。
```

- [ ] **Step 3: 更新架构文档**

在 `docs/architecture.md` 的“当前数据流”之后新增：

```markdown
## 验证层

- 单测层：三端前端 Vitest、四个 Python 包 pytest。
- 构建层：`scripts/verify-framework.ps1` 串起三端测试与 build/type-check。
- 真实链路层（2026-11-14）：`scripts/verify-acceptance.ps1` 启动 code1/code2/code3 三个 FastAPI 子进程，把 `SOS_DATABASE_PATH` / `ELDER_DATABASE_PATH` / `COMMUNITY_DATABASE_PATH` 全部指向 `tempfile.mkdtemp` 下的临时库，在动态 `127.0.0.1` 端口上验证 SOS、课程、学习记录、课程上下架与社区服务任务，并通过重启进程验证持久化。验收不 import 后端代码、不直接读表、不依赖预置课程，结束后删除临时目录。
- 两个验证入口互不调用，发布门禁要求两者都通过；`verify-framework.ps1` 保持零改动。
```

- [ ] **Step 4: 更新进度与交接**

在 `docs/progress.md` 的“更新日期：2026-11-14”之后新增章节，记录：

- 新增 `scripts/acceptance/` 基座与 `verify-acceptance.ps1`，22 项真实链路检查。
- 扩展到 33 项，覆盖课程上下架、下架后详情 404、重复切换 409、重启后状态持久化与重新发布恢复。
- 实际运行结果（预期 `ACCEPTANCE PASS (33 checks)`，以及支撑层 unittest 的数量）。
- 双门禁命令与“两命令互不调用”。
- 欠账：微信开发者工具中的人工联调仍需执行；验收不覆盖视频 multipart 上传、浏览器/小程序 UI。

在 `HANDOVER.md`：

- 一句话现状加入“跨端验收基座已落地，33 项真实链路检查与 `verify-framework.ps1` 组成双门禁”。
- “下一步开发候选”把已完成的验收基座移出候选，保留人工联调、AI/知识库等；注明验收基座的入口与新增目录。
- 关键路径速查增加 `scripts/verify-acceptance.ps1` 与 `scripts/acceptance/`。

- [ ] **Step 5: 运行双门禁**

Run（按顺序，任一步非零即停止）：

```powershell
.\scripts\verify-framework.ps1 -Python "E:\workspace\silver-companion-env\python.exe"
.\scripts\verify-acceptance.ps1 -Python "E:\workspace\silver-companion-env\python.exe"
```

Expected: 第一条退出码 0（三端测试与构建全过）；第二条末尾 `ACCEPTANCE PASS (33 checks)`；两条命令互不调用。

- [ ] **Step 6: 检查工作区**

```powershell
git status --short
```

Expected: 只含本任务修改的 5 个文档；无 `dist`、数据库、日志或临时文件。

- [ ] **Step 7: 提交**

```powershell
git add README.md AGENTS.md docs/architecture.md docs/progress.md HANDOVER.md
git commit -m "docs: document cross-end acceptance gate"
```

---

## 执行完成后的集成

- 合并一律 rebase + `--ff-only`，禁止 force push。
- 推送由用户执行；向用户报告分支、提交列表与命令。
- 任一验收失败时保留工作区与日志，不通过删除测试、放宽断言或跳过检查绕过。
