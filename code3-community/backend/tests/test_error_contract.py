"""错误信封契约：404 / 409 / 503 / 500 的 code、状态码与信息泄露边界。"""

import asyncio
import json

from fastapi.testclient import TestClient

from silver_companion_community.errors import (
    internal_error_handler,
    invalid_state_transition_handler,
    service_unavailable_handler,
    task_not_found_handler,
)
from silver_companion_community.main import create_app
from silver_companion_community.service_errors import (
    InvalidStateTransitionError,
    ServiceUnavailableError,
    TaskNotFoundError,
)

UNEXPECTED = {"Traceback", "sqlite", "SELECT", "C:\\", "/tmp/", "internal.db"}


def _render(handler, error) -> tuple[int, dict]:
    response = asyncio.run(handler(None, error))
    return response.status_code, json.loads(response.body)


def _assert_clean(body: dict) -> None:
    text = json.dumps(body, ensure_ascii=False)
    for leaked in UNEXPECTED:
        assert leaked not in text, f"错误体泄露了内部信息：{leaked}"


def test_task_not_found_envelope() -> None:
    status, body = _render(task_not_found_handler, TaskNotFoundError("task-1"))
    assert status == 404
    assert body == {"error": {"code": "task_not_found", "message": "服务任务不存在"}}
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message"}


def test_invalid_state_transition_envelope() -> None:
    status, body = _render(
        invalid_state_transition_handler,
        InvalidStateTransitionError("task-1", "completed", "accept"),
    )
    assert status == 409
    assert body["error"]["code"] == "invalid_state_transition"
    _assert_clean(body)


def test_service_unavailable_never_leaks_storage_details() -> None:
    error = ServiceUnavailableError("unable to open database file: C:\\tmp\\internal.db")
    status, body = _render(service_unavailable_handler, error)
    assert status == 503
    assert body == {"error": {"code": "service_unavailable", "message": "服务暂时不可用"}}
    _assert_clean(body)


def test_internal_error_never_leaks_sql_or_traceback() -> None:
    error = RuntimeError("Traceback ... sqlite3.OperationalError: SELECT * FROM service_tasks")
    status, body = _render(internal_error_handler, error)
    assert status == 500
    assert body == {"error": {"code": "internal_error", "message": "服务内部错误"}}
    _assert_clean(body)


def test_health_stays_independent_from_business_and_storage() -> None:
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "community-backend"}
