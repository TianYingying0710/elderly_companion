import pytest
from fastapi.testclient import TestClient

from silver_companion_elder.main import create_app
from silver_companion_elder.repositories.courses import get_course_repository

client = TestClient(create_app())


@pytest.fixture(autouse=True)
def reset_learning_records():
    get_course_repository().reset()
    yield
    get_course_repository().reset()

COURSE_NOT_FOUND = {
    "error": {
        "code": "course_not_found",
        "message": "课程不存在",
    }
}

RECORD_FIELDS = {"course_id", "progress_percent", "updated_at"}


def _put(course_id: str, progress: int) -> object:
    return client.put(f"/api/v1/learning-records/{course_id}", json={"progress_percent": progress})


def test_list_learning_records_starts_empty() -> None:
    response = client.get("/api/v1/learning-records")

    assert response.status_code == 200
    assert response.json() == []


def test_put_creates_record_with_contract_fields() -> None:
    response = _put("course-smartphone-basics", 40)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == RECORD_FIELDS
    assert body["course_id"] == "course-smartphone-basics"
    assert body["progress_percent"] == 40


def test_put_upserts_progress_for_same_course() -> None:
    _put("course-anti-fraud", 20)
    response = _put("course-anti-fraud", 80)

    assert response.status_code == 200
    listed = client.get("/api/v1/learning-records").json()
    records = [record for record in listed if record["course_id"] == "course-anti-fraud"]
    assert len(records) == 1
    assert records[0]["progress_percent"] == 80


def test_list_orders_records_newest_first() -> None:
    _put("course-smartphone-basics", 10)
    _put("course-anti-fraud", 20)

    listed = client.get("/api/v1/learning-records").json()
    ids = [record["course_id"] for record in listed]
    assert ids.index("course-anti-fraud") < ids.index("course-smartphone-basics")


def test_put_rejects_unknown_course_with_declared_404_payload() -> None:
    response = _put("course-not-in-catalog", 50)

    assert response.status_code == 404
    assert response.json() == COURSE_NOT_FOUND


def test_put_rejects_progress_out_of_contract_range() -> None:
    for invalid in (-1, 101):
        response = _put("course-smartphone-basics", invalid)

        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_failed"
