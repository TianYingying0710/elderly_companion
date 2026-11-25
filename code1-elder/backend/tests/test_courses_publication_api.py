import pytest
from fastapi.testclient import TestClient

from silver_companion_elder.main import create_app
from silver_companion_elder.repositories.courses import get_course_repository

client = TestClient(create_app())

COURSE_NOT_FOUND = {
    "error": {"code": "course_not_found", "message": "课程不存在"}
}
COURSE_NOT_EDITABLE = {
    "error": {"code": "course_not_editable", "message": "预置课程不支持上下架"}
}
ILLEGAL_COURSE_PUBLICATION = {
    "error": {
        "code": "illegal_course_publication",
        "message": "课程状态不允许重复变更",
    }
}

PAYLOAD = {
    "title": "上下架自动化测试课程",
    "category": "数字素养",
    "description": "自动化测试创建",
    "duration_seconds": 300,
    "outline": ["第一步", "第二步"],
}


@pytest.fixture(autouse=True)
def fresh_catalog(monkeypatch):
    monkeypatch.delenv("ELDER_DATABASE_PATH", raising=False)
    get_course_repository.cache_clear()
    yield
    get_course_repository.cache_clear()


def create_course() -> dict:
    response = client.post("/api/v1/courses", json=PAYLOAD)
    assert response.status_code == 201
    return response.json()


def set_publication(course_id: str, status: str):
    return client.post(
        f"/api/v1/courses/{course_id}/publication", json={"status": status}
    )


def test_created_course_is_published_and_editable() -> None:
    course = create_course()

    assert course["status"] == "published"
    assert course["editable"] is True
    listed = client.get("/api/v1/courses").json()
    assert course["id"] in {item["id"] for item in listed}


def test_unpublish_hides_course_from_default_catalog() -> None:
    course = create_course()

    response = set_publication(course["id"], "unpublished")

    assert response.status_code == 200
    assert response.json()["status"] == "unpublished"
    assert course["id"] not in {
        item["id"] for item in client.get("/api/v1/courses").json()
    }
    all_courses = client.get("/api/v1/courses?include_unpublished=true").json()
    hidden = next(item for item in all_courses if item["id"] == course["id"])
    assert hidden["status"] == "unpublished"
    assert hidden["editable"] is True


def test_unpublished_course_detail_returns_404() -> None:
    course = create_course()
    set_publication(course["id"], "unpublished")

    response = client.get(f"/api/v1/courses/{course['id']}")

    assert response.status_code == 404
    assert response.json() == COURSE_NOT_FOUND


def test_republish_restores_catalog_visibility() -> None:
    course = create_course()
    set_publication(course["id"], "unpublished")

    response = set_publication(course["id"], "published")

    assert response.status_code == 200
    assert response.json()["status"] == "published"
    assert course["id"] in {
        item["id"] for item in client.get("/api/v1/courses").json()
    }


def test_repeated_publication_returns_409() -> None:
    course = create_course()
    assert set_publication(course["id"], "unpublished").status_code == 200

    response = set_publication(course["id"], "unpublished")

    assert response.status_code == 409
    assert response.json() == ILLEGAL_COURSE_PUBLICATION


def test_preset_publication_returns_409() -> None:
    response = set_publication("course-smartphone-basics", "unpublished")

    assert response.status_code == 409
    assert response.json() == COURSE_NOT_EDITABLE


def test_preset_same_state_still_reports_not_editable() -> None:
    response = set_publication("course-smartphone-basics", "published")

    assert response.status_code == 409
    assert response.json() == COURSE_NOT_EDITABLE


def test_lost_publication_race_maps_to_409(monkeypatch) -> None:
    course = create_course()
    repository = get_course_repository()

    async def lose(_course_id, _status, expected_status):
        return None

    monkeypatch.setattr(repository, "set_publication", lose)

    response = set_publication(course["id"], "unpublished")

    assert response.status_code == 409
    assert response.json() == ILLEGAL_COURSE_PUBLICATION


def test_unknown_course_publication_returns_404() -> None:
    response = set_publication("course-ghost", "unpublished")

    assert response.status_code == 404
    assert response.json() == COURSE_NOT_FOUND


def test_invalid_publication_status_returns_422() -> None:
    course = create_course()

    response = set_publication(course["id"], "draft")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"


def test_learning_records_survive_unpublish() -> None:
    course = create_course()
    saved = client.put(
        f"/api/v1/learning-records/{course['id']}", json={"progress_percent": 30}
    )
    assert saved.status_code == 200

    set_publication(course["id"], "unpublished")

    records = client.get("/api/v1/learning-records").json()
    assert any(
        item["course_id"] == course["id"] and item["progress_percent"] == 30
        for item in records
    )
