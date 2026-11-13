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

EXPECTED_CHECKS = 33


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


def _database_signature(path: Path) -> tuple[int, int]:
    """仓库内既有数据库的轻量指纹：大小与纳秒级修改时间。"""
    try:
        info = path.stat()
    except OSError:
        # 基线里存在、之后消失也算变化，用哨兵值表达。
        return (-1, -1)
    return (info.st_size, info.st_mtime_ns)


def _repo_database_baseline(root: Path) -> dict[Path, tuple[int, int]]:
    return {
        relative: _database_signature(root / relative)
        for relative in support.snapshot_repo_databases(root)
    }


def _check_isolation(
    root: Path,
    database_paths: Mapping[str, Path],
    baseline: Mapping[Path, tuple[int, int]],
    reporter: support.Reporter,
) -> None:
    for env_name, path in database_paths.items():
        if not path.exists() or path.stat().st_size == 0:
            raise AssertionError(
                f"[G02] temp database missing or empty: {env_name} -> {path}"
            )
    added = support.snapshot_repo_databases(root) - set(baseline)
    if added:
        raise AssertionError(
            f"[G02] new repository database files: {sorted(str(path) for path in added)}"
        )
    changed = sorted(
        str(root / relative)
        for relative, signature in baseline.items()
        if _database_signature(root / relative) != signature
    )
    if changed:
        raise AssertionError(
            f"[G02] existing repository database files were modified: {changed}"
        )
    reporter.passed(
        "G02", "temp databases non-empty; repository databases unchanged"
    )


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
    # 临时目录与基线快照都在 try 内创建：任何早期异常也能走到 finally 清理。
    temp_dir: Path | None = None
    services: dict[str, support.RunningService] = {}
    try:
        temp_dir = support.create_temp_workspace()
        database_paths = {
            name: temp_dir / filename for name, filename in ALL_DATABASE_FILES.items()
        }
        baseline = _repo_database_baseline(root)
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
        if reporter.checks != EXPECTED_CHECKS:
            raise AssertionError(
                "[COUNT] acceptance check count mismatch: "
                f"expected {EXPECTED_CHECKS}, got {reporter.checks}"
            )
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
        if temp_dir is not None:
            shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
