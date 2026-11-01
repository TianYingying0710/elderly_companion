"""服务任务 API：201 创建、200 查询、404/409/422/503、持久化与 /health 独立性。"""

from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from silver_companion_community.dependencies.database import DATABASE_PATH_ENV
from silver_companion_community.main import create_app

SCHEDULED = datetime(2026, 11, 1, 6, 30, tzinfo=timezone.utc).isoformat()


def _payload(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "title": "代缴水电费",
        "elder_name": "示例老人 B",
        "category": "代办服务",
        "scheduled_at": SCHEDULED,
        "location": "XX 社区服务中心窗口",
        "description": "按老人委托到窗口代缴本月水电费",
    }
    base.update(overrides)
    return base


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv(DATABASE_PATH_ENV, str(tmp_path / "community.db"))
    return TestClient(create_app())


def _create(client: TestClient, **overrides: object) -> dict:
    response = client.post("/api/v1/service-tasks", json=_payload(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


def test_empty_database_returns_a_real_empty_list(client: TestClient) -> None:
    response = client.get("/api/v1/service-tasks")

    assert response.status_code == 200
    assert response.json() == []


def test_create_returns_201_with_pending_status_and_no_note(client: TestClient) -> None:
    created = _create(client)

    assert created["status"] == "pending"
    assert created["note"] is None
    assert created["id"]
    assert created["title"] == "代缴水电费"
    assert created["elder_name"] == "示例老人 B"
    assert created["category"] == "代办服务"
    assert created["location"] == "XX 社区服务中心窗口"


def test_created_task_is_listed_and_readable(client: TestClient) -> None:
    created = _create(client)

    listed = client.get("/api/v1/service-tasks")
    detail = client.get(f"/api/v1/service-tasks/{created['id']}")

    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [created["id"]]
    assert detail.status_code == 200
    assert detail.json()["id"] == created["id"]


def test_accept_moves_pending_to_in_service(client: TestClient) -> None:
    created = _create(client)

    accepted = client.post(f"/api/v1/service-tasks/{created['id']}/accept")

    assert accepted.status_code == 200
    assert accepted.json()["status"] == "in_service"
    assert client.get(f"/api/v1/service-tasks/{created['id']}").json()["status"] == "in_service"


def test_accept_twice_returns_conflict(client: TestClient) -> None:
    created = _create(client)
    client.post(f"/api/v1/service-tasks/{created['id']}/accept")

    response = client.post(f"/api/v1/service-tasks/{created['id']}/accept")

    assert response.status_code == 409
    assert response.json() == {
        "error": {"code": "invalid_state_transition", "message": "该任务当前状态不允许此操作"}
    }


def test_pending_cannot_be_completed(client: TestClient) -> None:
    created = _create(client)

    response = client.post(
        f"/api/v1/service-tasks/{created['id']}/complete", json={"note": "已协助办理"}
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "invalid_state_transition"


def test_complete_writes_note_and_is_terminal(client: TestClient) -> None:
    created = _create(client)
    client.post(f"/api/v1/service-tasks/{created['id']}/accept")

    completed = client.post(
        f"/api/v1/service-tasks/{created['id']}/complete", json={"note": " 已代缴并回传凭证 "}
    )

    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["note"] == "已代缴并回传凭证"

    assert client.post(f"/api/v1/service-tasks/{created['id']}/accept").status_code == 409
    assert (
        client.post(
            f"/api/v1/service-tasks/{created['id']}/complete", json={"note": "重复完成"}
        ).status_code
        == 409
    )


@pytest.mark.parametrize("note", ["", "   "])
def test_complete_requires_a_non_empty_note(client: TestClient, note: str) -> None:
    created = _create(client)
    client.post(f"/api/v1/service-tasks/{created['id']}/accept")

    response = client.post(f"/api/v1/service-tasks/{created['id']}/complete", json={"note": note})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"
    assert any(field["path"] == "body.note" for field in response.json()["error"]["fields"])


def test_complete_without_note_field_is_rejected(client: TestClient) -> None:
    created = _create(client)
    client.post(f"/api/v1/service-tasks/{created['id']}/accept")

    response = client.post(f"/api/v1/service-tasks/{created['id']}/complete", json={})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"


def test_missing_task_returns_404(client: TestClient) -> None:
    assert client.get("/api/v1/service-tasks/missing").status_code == 404
    assert client.post("/api/v1/service-tasks/missing/accept").status_code == 404
    assert (
        client.post("/api/v1/service-tasks/missing/complete", json={"note": "已处理"}).status_code
        == 404
    )
    assert client.get("/api/v1/service-tasks/missing").json() == {
        "error": {"code": "task_not_found", "message": "服务任务不存在"}
    }


@pytest.mark.parametrize("field", ["id", "status", "note"])
def test_create_rejects_server_owned_fields(client: TestClient, field: str) -> None:
    response = client.post("/api/v1/service-tasks", json=_payload(**{field: "client-value"}))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"


def test_create_requires_every_business_field(client: TestClient) -> None:
    for field in ("title", "elder_name", "category", "scheduled_at", "location", "description"):
        payload = _payload()
        payload.pop(field)
        response = client.post("/api/v1/service-tasks", json=payload)
        assert response.status_code == 422, field


def test_create_rejects_text_over_the_limit_without_persisting(client: TestClient) -> None:
    response = client.post("/api/v1/service-tasks", json=_payload(title="长" * 101))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"
    assert any(field["path"] == "body.title" for field in response.json()["error"]["fields"])
    assert client.get("/api/v1/service-tasks").json() == []


def test_complete_rejects_a_note_over_the_limit_and_keeps_state(client: TestClient) -> None:
    created = _create(client)
    client.post(f"/api/v1/service-tasks/{created['id']}/accept")

    response = client.post(
        f"/api/v1/service-tasks/{created['id']}/complete", json={"note": "记" * 2001}
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"
    assert client.get(f"/api/v1/service-tasks/{created['id']}").json()["status"] == "in_service"


def test_complete_rejects_unknown_fields(client: TestClient) -> None:
    created = _create(client)
    client.post(f"/api/v1/service-tasks/{created['id']}/accept")

    response = client.post(
        f"/api/v1/service-tasks/{created['id']}/complete",
        json={"note": "已处理", "status": "completed"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"
    assert client.get(f"/api/v1/service-tasks/{created['id']}").json()["status"] == "in_service"


def test_blank_task_id_and_bad_filters_are_rejected(client: TestClient) -> None:
    assert client.get("/api/v1/service-tasks/%20").status_code == 422
    assert client.get("/api/v1/service-tasks", params={"limit": 0}).status_code == 422
    assert client.get("/api/v1/service-tasks", params={"limit": 101}).status_code == 422
    assert client.get("/api/v1/service-tasks", params={"status": "bogus"}).status_code == 422
    assert client.get("/api/v1/service-tasks", params={"limit": 20}).status_code == 200


def test_data_survives_a_new_client_with_the_same_database(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(DATABASE_PATH_ENV, str(tmp_path / "community.db"))
    first = TestClient(create_app())
    created = _create(first)
    first.post(f"/api/v1/service-tasks/{created['id']}/accept")
    first.post(f"/api/v1/service-tasks/{created['id']}/complete", json={"note": "已代缴"})

    second = TestClient(create_app())
    reloaded = second.get(f"/api/v1/service-tasks/{created['id']}")

    assert reloaded.status_code == 200
    assert reloaded.json()["status"] == "completed"
    assert reloaded.json()["note"] == "已代缴"


def test_unconfigured_database_returns_503_and_keeps_health_green(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(DATABASE_PATH_ENV, raising=False)
    client = TestClient(create_app())

    response = client.get("/api/v1/service-tasks")

    assert response.status_code == 503
    assert response.json() == {
        "error": {"code": "service_unavailable", "message": "服务暂时不可用"}
    }
    assert client.get("/health").status_code == 200
    assert client.get("/health").json() == {"status": "ok", "service": "community-backend"}


def test_missing_database_directory_is_created_on_first_use(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    target = tmp_path / "data" / "community.db"
    monkeypatch.setenv(DATABASE_PATH_ENV, str(target))
    assert not target.parent.exists()
    client = TestClient(create_app())

    response = client.get("/api/v1/service-tasks")

    assert response.status_code == 200
    assert response.json() == []
    assert target.parent.is_dir()
    assert target.exists()


def test_unusable_database_path_returns_503(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    blocker = tmp_path / "blocked"
    blocker.write_text("occupied", encoding="utf-8")
    monkeypatch.setenv(DATABASE_PATH_ENV, str(blocker / "community.db"))
    client = TestClient(create_app())

    response = client.post("/api/v1/service-tasks", json=_payload())

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"
    assert "community.db" not in response.text
    assert client.get("/health").status_code == 200


def test_scheduled_at_must_be_timezone_aware(client: TestClient) -> None:
    response = client.post(
        "/api/v1/service-tasks", json=_payload(scheduled_at="2026-11-01T14:30:00")
    )

    assert response.status_code == 422
