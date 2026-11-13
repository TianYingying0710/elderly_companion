"""SOS 事件 SQLite 持久化测试（2026-11-14 授权例外）。

覆盖：CRUD 往返、按老人过滤与倒序、条件流转（含过期期望值）、
并发竞争唯一胜者、环境变量接线与「重启后数据仍在」。"""

import threading

import pytest
from fastapi.testclient import TestClient

from silver_companion_elder.main import create_app
from silver_companion_elder.repositories.sos_events import get_sos_event_repository
from silver_companion_elder.repositories.sqlite_sos_events import SqliteSosEventRepository
from silver_companion_elder.schemas.sos_events import SosEventCreate


def make_repository(tmp_path, name: str = "sos.db") -> SqliteSosEventRepository:
    repository = SqliteSosEventRepository(tmp_path / name)
    repository.initialize()
    return repository


def run(coro):
    import asyncio

    return asyncio.run(coro)


def test_create_then_get_roundtrip(tmp_path) -> None:
    repository = make_repository(tmp_path)

    event = run(repository.create(SosEventCreate(elder_id="elder-1", note="客厅需要帮助")))
    assert event.status == "pending"
    assert event.id

    loaded = run(repository.get(event.id))
    assert loaded == event


def test_list_filters_by_elder_and_orders_newest_first(tmp_path) -> None:
    repository = make_repository(tmp_path)
    first = run(repository.create(SosEventCreate(elder_id="elder-1")))
    second = run(repository.create(SosEventCreate(elder_id="elder-1")))
    run(repository.create(SosEventCreate(elder_id="elder-2")))

    events = run(repository.list("elder-1"))
    assert [event.id for event in events] == [second.id, first.id]

    assert len(run(repository.list())) == 3


def test_conditional_update_moves_forward_and_rejects_stale_expected(tmp_path) -> None:
    repository = make_repository(tmp_path)
    event = run(repository.create(SosEventCreate(elder_id="elder-1")))

    updated = run(repository.update_status(event.id, "processing", expected_status="pending"))
    assert updated is not None
    assert updated.status == "processing"

    # 期望值过期（库中已是 processing）→ 未命中返回 None
    assert run(repository.update_status(event.id, "resolved", expected_status="pending")) is None

    # 正确期望值可继续前进
    resolved = run(repository.update_status(event.id, "resolved", expected_status="processing"))
    assert resolved is not None
    assert resolved.status == "resolved"


def test_concurrent_transition_has_single_winner(tmp_path) -> None:
    """同一数据库、两个独立连接同时流转，只有一个成功（与 code3 服务任务同规则）。"""
    path = tmp_path / "race.db"
    writer = SqliteSosEventRepository(path)
    writer.initialize()
    event = run(writer.create(SosEventCreate(elder_id="elder-race")))

    repository_a = SqliteSosEventRepository(path)
    repository_b = SqliteSosEventRepository(path)
    results: list[object] = []
    barrier = threading.Barrier(2)

    def contend(repository: SqliteSosEventRepository) -> None:
        barrier.wait()
        results.append(
            run(repository.update_status(event.id, "processing", expected_status="pending"))
        )

    thread_a = threading.Thread(target=contend, args=(repository_a,))
    thread_b = threading.Thread(target=contend, args=(repository_b,))
    thread_a.start()
    thread_b.start()
    thread_a.join()
    thread_b.join()

    statuses = sorted("hit" if result is not None else "miss" for result in results)
    assert statuses == ["hit", "miss"]


def test_env_wired_api_persists_across_restart(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "wired" / "sos.db"
    monkeypatch.setenv("SOS_DATABASE_PATH", str(database_path))
    get_sos_event_repository.cache_clear()
    try:
        client = TestClient(create_app())
        created = client.post(
            "/api/v1/sos-events", json={"elder_id": "elder-001", "note": "卧室需要帮助"}
        )
        assert created.status_code == 201
        event_id = created.json()["id"]

        # 模拟服务重启：清空依赖单例后重建应用，事件必须仍在
        get_sos_event_repository.cache_clear()
        restarted = TestClient(create_app())
        listed = restarted.get("/api/v1/sos-events", params={"elder_id": "elder-001"})
        assert listed.status_code == 200
        body = listed.json()
        assert [item["id"] for item in body] == [event_id]
        assert body[0]["status"] == "pending"
        assert body[0]["note"] == "卧室需要帮助"

        # 状态流转在持久化存储上同样生效
        patched = restarted.patch(f"/api/v1/sos-events/{event_id}", json={"status": "processing"})
        assert patched.status_code == 200
        assert patched.json()["status"] == "processing"
    finally:
        get_sos_event_repository.cache_clear()


def test_default_without_env_stays_in_memory(monkeypatch, tmp_path) -> None:
    monkeypatch.delenv("SOS_DATABASE_PATH", raising=False)
    get_sos_event_repository.cache_clear()
    try:
        client = TestClient(create_app())
        created = client.post("/api/v1/sos-events", json={"elder_id": "elder-mem"})
        assert created.status_code == 201
        assert not list(tmp_path.iterdir())  # 不应在测试目录留下任何数据库文件
    finally:
        get_sos_event_repository.cache_clear()


def test_database_error_maps_to_storage_unavailable(tmp_path) -> None:
    from silver_companion_elder.errors import SosStorageUnavailableError

    repository = make_repository(tmp_path)
    # 把数据库文件替换成目录，制造 sqlite3.Error
    (tmp_path / "sos.db").unlink()
    (tmp_path / "sos.db").mkdir()

    with pytest.raises(SosStorageUnavailableError):
        run(repository.list())
