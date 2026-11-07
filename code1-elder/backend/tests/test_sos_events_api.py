from fastapi.testclient import TestClient

from silver_companion_elder.main import create_app

client = TestClient(create_app())

NOT_FOUND = {
    "error": {
        "code": "sos_event_not_found",
        "message": "求助事件不存在",
    }
}

ILLEGAL_TRANSITION = {
    "error": {
        "code": "illegal_sos_status_transition",
        "message": "求助事件状态不允许回退或重复流转",
    }
}


def _create(elder_id: str, note: str | None = None) -> dict:
    payload: dict = {"elder_id": elder_id}
    if note is not None:
        payload["note"] = note
    response = client.post("/api/v1/sos-events", json=payload)
    assert response.status_code == 201
    return response.json()


def test_create_sos_event_returns_pending_event_with_full_fields() -> None:
    body = _create("elder-sos-1", note="客厅需要帮助")

    assert body["elder_id"] == "elder-sos-1"
    assert body["status"] == "pending"
    assert body["note"] == "客厅需要帮助"
    assert body["id"]
    assert body["created_at"]
    assert set(body) == {"id", "elder_id", "created_at", "status", "note"}


def test_create_sos_event_allows_missing_note() -> None:
    body = _create("elder-sos-2")
    assert body["note"] is None


def test_create_sos_event_rejects_invalid_elder_id() -> None:
    response = client.post("/api/v1/sos-events", json={"elder_id": "含空格 id"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"
    assert any(f["path"] == "body.elder_id" for f in response.json()["error"]["fields"])


def test_list_sos_events_filters_by_elder_id_and_orders_newest_first() -> None:
    first = _create("elder-sos-3")
    second = _create("elder-sos-3")
    _create("elder-sos-other")

    response = client.get("/api/v1/sos-events", params={"elder_id": "elder-sos-3"})

    assert response.status_code == 200
    body = response.json()
    assert {event["id"] for event in body} == {first["id"], second["id"]}
    created_ats = [event["created_at"] for event in body]
    assert created_ats == sorted(created_ats, reverse=True)


def test_status_transitions_only_move_forward() -> None:
    event = _create("elder-sos-4")
    event_id = event["id"]

    processing = client.patch(f"/api/v1/sos-events/{event_id}", json={"status": "processing"})
    assert processing.status_code == 200
    assert processing.json()["status"] == "processing"

    resolved = client.patch(f"/api/v1/sos-events/{event_id}", json={"status": "resolved"})
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "resolved"

    backward = client.patch(f"/api/v1/sos-events/{event_id}", json={"status": "pending"})
    assert backward.status_code == 409
    assert backward.json() == ILLEGAL_TRANSITION

    repeated = client.patch(f"/api/v1/sos-events/{event_id}", json={"status": "resolved"})
    assert repeated.status_code == 409
    assert repeated.json() == ILLEGAL_TRANSITION


def test_update_status_rejects_unknown_event_id() -> None:
    response = client.patch("/api/v1/sos-events/not-exist", json={"status": "processing"})

    assert response.status_code == 404
    assert response.json() == NOT_FOUND


def test_update_status_validates_status_value() -> None:
    event = _create("elder-sos-5")

    response = client.patch(f"/api/v1/sos-events/{event['id']}", json={"status": "done"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"
