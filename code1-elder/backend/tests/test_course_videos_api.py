import pytest
from fastapi.testclient import TestClient

from silver_companion_elder.main import create_app
from silver_companion_elder.repositories.courses import get_course_repository

client = TestClient(create_app())


@pytest.fixture(autouse=True)
def reset_repository():
    get_course_repository().reset()
    yield
    get_course_repository().reset()


def _upload(name: str = "clip.mp4", content: bytes = b"fake-video-bytes") -> dict:
    response = client.post(
        "/api/v1/course-videos", files={"file": (name, content, "video/mp4")}
    )
    assert response.status_code == 201
    return response.json()


def test_upload_mp4_returns_video_id_and_url() -> None:
    body = _upload()

    assert set(body) == {"video_id", "video_url"}
    assert body["video_url"] == f"/api/v1/course-videos/{body['video_id']}"


def test_upload_rejects_non_mp4_files() -> None:
    response = client.post(
        "/api/v1/course-videos", files={"file": ("notes.txt", b"hello", "text/plain")}
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"


def test_stream_uploaded_video_back() -> None:
    video = _upload(content=b"mp4-bytes-for-streaming")

    response = client.get(video["video_url"])

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("video/mp4")
    assert response.content == b"mp4-bytes-for-streaming"


def test_stream_unknown_video_returns_declared_404_payload() -> None:
    response = client.get("/api/v1/course-videos/no-such-video")

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "video_not_found", "message": "视频不存在"}
    }


def test_create_course_with_uploaded_video_appears_in_catalog() -> None:
    video = _upload()
    payload = {
        "title": "智能手机支付安全",
        "category": "数字素养",
        "description": "学会安全使用手机支付，避免上当。",
        "duration_seconds": 420,
        "outline": ["支付密码保护", "识别钓鱼链接"],
        "video_id": video["video_id"],
    }

    created = client.post("/api/v1/courses", json=payload)
    assert created.status_code == 201
    course = created.json()
    assert course["video_url"] == video["video_url"]

    listed = client.get("/api/v1/courses").json()
    match = [item for item in listed if item["id"] == course["id"]]
    assert len(match) == 1
    assert match[0]["video_url"] == video["video_url"]


def test_create_course_without_video_is_allowed() -> None:
    payload = {
        "title": "智能手机支付安全",
        "category": "数字素养",
        "description": "学会安全使用手机支付，避免上当。",
        "duration_seconds": 420,
        "outline": ["支付密码保护"],
    }

    response = client.post("/api/v1/courses", json=payload)

    assert response.status_code == 201
    assert response.json()["video_url"] is None


def test_create_course_with_unknown_video_id_is_rejected() -> None:
    payload = {
        "title": "智能手机支付安全",
        "category": "数字素养",
        "description": "学会安全使用手机支付，避免上当。",
        "duration_seconds": 420,
        "outline": ["支付密码保护"],
        "video_id": "ghost-video",
    }

    response = client.post("/api/v1/courses", json=payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"


def test_create_course_validates_payload() -> None:
    response = client.post(
        "/api/v1/courses",
        json={"title": "", "category": "数字素养", "description": "x", "duration_seconds": 1, "outline": ["a"]},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"
