"""SQLite Repository 集成测试：临时数据库、建表幂等、往返、过滤、重启保留、不可用翻译、双连接竞争。"""

import asyncio
import contextlib
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

import pytest

from silver_companion_community.repositories.sqlite_service_tasks import (
    SqliteServiceTaskRepository,
)
from silver_companion_community.schemas.service import ServiceStatus, ServiceTask
from silver_companion_community.service_errors import ServiceUnavailableError

AWARE = datetime(2026, 11, 1, 14, 30, tzinfo=timezone.utc)


def _task(task_id: str, status: ServiceStatus = ServiceStatus.pending) -> ServiceTask:
    return ServiceTask(
        id=task_id,
        title="代缴水电费",
        elder_name="示例老人 B",
        category="代办服务",
        scheduled_at=AWARE,
        location="XX 社区服务中心窗口",
        description="按老人委托到窗口代缴本月水电费",
        status=status,
        note="已代缴并回传凭证" if status is ServiceStatus.completed else None,
    )


def _repository(tmp_path: Path) -> SqliteServiceTaskRepository:
    repository = SqliteServiceTaskRepository(tmp_path / "community.db")
    repository.initialize()
    return repository


def test_initialize_is_idempotent_and_creates_no_rows(tmp_path: Path) -> None:
    repository = _repository(tmp_path)
    repository.initialize()

    assert asyncio.run(repository.list_tasks()) == []
    assert (tmp_path / "community.db").exists()


def test_save_then_read_roundtrips_every_field(tmp_path: Path) -> None:
    repository = _repository(tmp_path)
    task = _task("task-1")

    asyncio.run(repository.save_task(task))
    loaded = asyncio.run(repository.get_task("task-1"))

    assert loaded is not None
    assert loaded.id == task.id
    assert loaded.title == task.title
    assert loaded.elder_name == task.elder_name
    assert loaded.category == task.category
    assert loaded.scheduled_at == task.scheduled_at
    assert loaded.location == task.location
    assert loaded.description == task.description
    assert loaded.status is ServiceStatus.pending
    assert loaded.note is None


def test_save_updates_status_and_note_without_losing_identity(tmp_path: Path) -> None:
    repository = _repository(tmp_path)
    asyncio.run(repository.save_task(_task("task-1")))
    asyncio.run(repository.save_task(_task("task-1", ServiceStatus.completed)))

    loaded = asyncio.run(repository.get_task("task-1"))

    assert loaded is not None
    assert loaded.status is ServiceStatus.completed
    assert loaded.note == "已代缴并回传凭证"
    rows = asyncio.run(repository.list_tasks())
    assert len(rows) == 1


def test_list_filters_by_status_and_applies_limit(tmp_path: Path) -> None:
    repository = _repository(tmp_path)
    asyncio.run(repository.save_task(_task("a", ServiceStatus.pending)))
    asyncio.run(repository.save_task(_task("b", ServiceStatus.in_service)))
    asyncio.run(repository.save_task(_task("c", ServiceStatus.completed)))

    assert {task.id for task in asyncio.run(repository.list_tasks())} == {"a", "b", "c"}
    completed = asyncio.run(repository.list_tasks(ServiceStatus.completed))
    assert [task.id for task in completed] == ["c"]
    assert len(asyncio.run(repository.list_tasks(None, 2))) == 2


def test_data_survives_a_new_repository_instance(tmp_path: Path) -> None:
    repository = _repository(tmp_path)
    asyncio.run(repository.save_task(_task("task-1", ServiceStatus.completed)))

    reopened = SqliteServiceTaskRepository(tmp_path / "community.db")
    reopened.initialize()
    loaded = asyncio.run(reopened.get_task("task-1"))

    assert loaded is not None
    assert loaded.status is ServiceStatus.completed
    assert loaded.note == "已代缴并回传凭证"


def test_missing_row_returns_none(tmp_path: Path) -> None:
    assert asyncio.run(_repository(tmp_path).get_task("missing")) is None


def test_transition_succeeds_only_once_for_the_expected_status(tmp_path: Path) -> None:
    repository = _repository(tmp_path)
    asyncio.run(repository.save_task(_task("task-1")))
    accepted = _task("task-1", ServiceStatus.in_service)

    first = asyncio.run(repository.transition_task(accepted, ServiceStatus.pending))
    second = asyncio.run(repository.transition_task(accepted, ServiceStatus.pending))

    assert first is True
    assert second is False
    loaded = asyncio.run(repository.get_task("task-1"))
    assert loaded is not None
    assert loaded.status is ServiceStatus.in_service


def test_transition_rejects_a_wrong_expected_status(tmp_path: Path) -> None:
    repository = _repository(tmp_path)
    asyncio.run(repository.save_task(_task("task-1")))

    result = asyncio.run(
        repository.transition_task(_task("task-1", ServiceStatus.completed), ServiceStatus.in_service)
    )

    assert result is False
    loaded = asyncio.run(repository.get_task("task-1"))
    assert loaded is not None
    assert loaded.status is ServiceStatus.pending


def test_transition_keeps_created_at_and_writes_note(tmp_path: Path) -> None:
    repository = _repository(tmp_path)
    asyncio.run(repository.save_task(_task("task-1", ServiceStatus.in_service)))
    database = tmp_path / "community.db"
    # 必须显式 close：`with sqlite3.connect(...)` 只提交事务，不关闭连接，
    # 在 Windows 上会让 pytest 无法删除临时目录（留下 garbage-* 目录）。
    with contextlib.closing(sqlite3.connect(database)) as connection:
        created_before = connection.execute(
            "SELECT created_at FROM service_tasks WHERE id = 'task-1'"
        ).fetchone()[0]

    completed = asyncio.run(
        repository.transition_task(
            _task("task-1", ServiceStatus.completed), ServiceStatus.in_service
        )
    )

    assert completed is True
    with contextlib.closing(sqlite3.connect(database)) as connection:
        row = connection.execute(
            "SELECT created_at, status, note FROM service_tasks WHERE id = 'task-1'"
        ).fetchone()
    assert row[0] == created_before
    assert row[1] == "completed"
    assert row[2] == "已代缴并回传凭证"


def _run_racing_transition(
    repositories: list[SqliteServiceTaskRepository],
    tasks: list[ServiceTask],
    expected_status: ServiceStatus,
) -> list[bool]:
    """让多个线程在同一个屏障后，用各自独立的 Repository/连接竞争同一次条件更新。

    返回值与传入的 Repository/任务按下标一一对应，不依赖线程完成顺序。
    """
    assert len(repositories) == len(tasks)
    barrier = threading.Barrier(len(repositories))
    outcomes: list[bool | None] = [None] * len(repositories)
    errors: list[BaseException] = []
    lock = threading.Lock()

    def worker(index: int, repository: SqliteServiceTaskRepository, task: ServiceTask) -> None:
        try:
            barrier.wait(timeout=10)
            updated = asyncio.run(repository.transition_task(task, expected_status))
        except BaseException as error:  # 线程内异常必须带回主线程断言，不能被吞掉
            with lock:
                errors.append(error)
            return
        with lock:
            outcomes[index] = updated

    threads = [
        threading.Thread(target=worker, args=(index, repository, task), daemon=True)
        for index, (repository, task) in enumerate(zip(repositories, tasks))
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    assert not any(thread.is_alive() for thread in threads), "竞争线程未在 30s 内结束"
    assert errors == [], f"竞争过程中出现异常：{errors!r}"
    assert None not in outcomes, "存在未返回结果的竞争线程"
    return [bool(outcome) for outcome in outcomes]


def test_two_independent_connections_cannot_both_accept_the_same_task(tmp_path: Path) -> None:
    first = _repository(tmp_path)
    second = SqliteServiceTaskRepository(tmp_path / "community.db")
    second.initialize()
    asyncio.run(first.save_task(_task("task-1")))

    accepted = _task("task-1", ServiceStatus.in_service)
    outcomes = _run_racing_transition([first, second], [accepted, accepted], ServiceStatus.pending)

    assert sorted(outcomes) == [False, True]
    loaded = asyncio.run(first.get_task("task-1"))
    assert loaded is not None
    assert loaded.status is ServiceStatus.in_service


def test_two_independent_connections_keep_only_the_winner_note(tmp_path: Path) -> None:
    repository = _repository(tmp_path)
    second = SqliteServiceTaskRepository(tmp_path / "community.db")
    second.initialize()
    asyncio.run(repository.save_task(_task("task-1", ServiceStatus.in_service)))

    notes = ["第一个写入者的服务记录", "第二个写入者的服务记录"]
    competitors = [
        _task("task-1", ServiceStatus.completed).model_copy(update={"note": note}) for note in notes
    ]
    outcomes = _run_racing_transition([repository, second], competitors, ServiceStatus.in_service)

    assert sorted(outcomes) == [False, True]
    winner_note = notes[outcomes.index(True)]
    loaded = asyncio.run(repository.get_task("task-1"))
    assert loaded is not None
    assert loaded.status is ServiceStatus.completed
    assert loaded.note == winner_note
    assert loaded.note in notes


def test_unusable_path_raises_service_unavailable(tmp_path: Path) -> None:
    blocker = tmp_path / "not-a-directory"
    blocker.write_text("occupied", encoding="utf-8")

    with pytest.raises(ServiceUnavailableError):
        SqliteServiceTaskRepository(blocker / "community.db").initialize()

    with pytest.raises(ServiceUnavailableError):
        asyncio.run(SqliteServiceTaskRepository(blocker / "community.db").list_tasks())
