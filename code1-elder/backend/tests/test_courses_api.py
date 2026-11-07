from fastapi.testclient import TestClient

from silver_companion_elder.main import create_app

client = TestClient(create_app())

COURSE_NOT_FOUND = {
    "error": {
        "code": "course_not_found",
        "message": "课程不存在",
    }
}

SUMMARY_FIELDS = {"id", "title", "category", "description", "duration_seconds", "video_url"}


def test_list_courses_returns_demo_catalog_with_contract_fields() -> None:
    response = client.get("/api/v1/courses")

    assert response.status_code == 200
    body = response.json()
    assert len(body) >= 3
    for course in body:
        assert set(course) == SUMMARY_FIELDS
        assert isinstance(course["duration_seconds"], int)
        assert course["duration_seconds"] >= 0


def test_get_course_detail_returns_outline_list() -> None:
    course_id = client.get("/api/v1/courses").json()[0]["id"]

    response = client.get(f"/api/v1/courses/{course_id}")

    assert response.status_code == 200
    body = response.json()
    assert set(body) == SUMMARY_FIELDS | {"outline"}
    assert isinstance(body["outline"], list)
    assert len(body["outline"]) >= 1


def test_get_unknown_course_returns_declared_404_payload() -> None:
    response = client.get("/api/v1/courses/not-exist-course")

    assert response.status_code == 404
    assert response.json() == COURSE_NOT_FOUND
