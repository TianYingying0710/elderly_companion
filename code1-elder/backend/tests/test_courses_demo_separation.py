"""演示课程与社区真实课程的分离契约（2026-11-24）。

验收口径（对应用户需求第 2/3/5/8 条）：
1. 配置 ELDER_DATABASE_PATH（API 模式）时，`GET /api/v1/courses` 不得出现 5 条硬编码演示课程；
2. 同一请求必须返回库里社区端发布的真实课程；
3. 真实课程详情里的 `video_url` 指向已登记的视频，且能取到视频字节（Range 播放入口）；
4. 演示课程 id 走详情接口返回 404，不能被当成真实课程；
5. 服务重启（清空依赖单例后重建应用）后课程与视频关联仍在。
"""

import io

import pytest
from fastapi.testclient import TestClient

from silver_companion_elder.main import create_app
from silver_companion_elder.repositories import courses as courses_repository
from silver_companion_elder.repositories import sqlite_courses
from silver_companion_elder.repositories.courses import get_course_repository

DEMO_COURSE_IDS = {
    "course-smartphone-basics",
    "course-anti-fraud",
    "course-video-call",
    "course-health-walking",
    "course-emergency-sos",
}

REAL_COURSE_ID = "course-e41d2bc4cd9a"
REAL_VIDEO_ID = "a4d00ef5bb5d"
REAL_COURSE_PAYLOAD = {
    "title": "怎么使用微信",
    "category": "手机基础",
    "description": "教老年人使用微信",
    "duration_seconds": 0,
    "outline": ["123"],
}


@pytest.fixture()
def api_client(tmp_path, monkeypatch):
    """每个用例一个独立数据库 + 独立视频目录，避免污染仓库里的真实库与上传目录。"""
    monkeypatch.setenv("ELDER_DATABASE_PATH", str(tmp_path / "courses.db"))
    # 上传接口会把文件落到 VIDEO_STORAGE_DIR；测试必须重定向到 tmp_path，
    # 否则每跑一次就在 data/uploads/videos/ 里多留一个孤儿 mp4。
    video_dir = tmp_path / "uploads" / "videos"
    monkeypatch.setattr(sqlite_courses, "VIDEO_STORAGE_DIR", video_dir)
    monkeypatch.setattr(courses_repository, "VIDEO_STORAGE_DIR", video_dir)
    get_course_repository.cache_clear()
    try:
        yield TestClient(create_app())
    finally:
        get_course_repository.cache_clear()


def _publish_course_with_video(client: TestClient) -> tuple[str, str]:
    uploaded = client.post(
        "/api/v1/course-videos",
        files={"file": ("wechat.mp4", io.BytesIO(b"wechat-video-bytes"), "video/mp4")},
    )
    assert uploaded.status_code in (200, 201), uploaded.text
    video_id = uploaded.json()["video_id"]
    created = client.post(
        "/api/v1/courses", json={**REAL_COURSE_PAYLOAD, "video_id": video_id}
    )
    assert created.status_code in (200, 201), created.text
    return created.json()["id"], video_id


def test_api_list_excludes_five_demo_courses(api_client) -> None:
    """API 列表不得包含 5 条演示课程，只允许库里真实发布的课程。"""
    _publish_course_with_video(api_client)

    response = api_client.get("/api/v1/courses")
    assert response.status_code == 200
    ids = {row["id"] for row in response.json()}

    assert ids.isdisjoint(DEMO_COURSE_IDS)
    titles = {row["title"] for row in response.json()}
    assert titles.isdisjoint(
        {"智能手机基础操作", "防电信诈骗指南", "和家人视频通话", "居家健步走", "紧急求助按钮使用"}
    )


def test_api_list_contains_only_database_courses(api_client) -> None:
    """空库时 API 列表为空；发布一门课后只返回这一门。"""
    assert api_client.get("/api/v1/courses").json() == []

    course_id, _ = _publish_course_with_video(api_client)
    rows = api_client.get("/api/v1/courses").json()

    assert [row["id"] for row in rows] == [course_id]
    assert rows[0]["title"] == "怎么使用微信"
    assert rows[0]["status"] == "published"


def test_real_course_detail_returns_video_url(api_client) -> None:
    """真实课程详情能返回正确视频地址，且视频按 Range 返回 206。"""
    course_id, video_id = _publish_course_with_video(api_client)

    detail = api_client.get(f"/api/v1/courses/{course_id}")
    assert detail.status_code == 200
    assert detail.json()["video_url"] == f"/api/v1/course-videos/{video_id}"

    ranged = api_client.get(
        f"/api/v1/course-videos/{video_id}", headers={"Range": "bytes=0-3"}
    )
    assert ranged.status_code == 206
    assert ranged.content == b"wech"
    assert ranged.headers["accept-ranges"] == "bytes"


def test_demo_course_detail_returns_404(api_client) -> None:
    """演示课程 id 在 API 模式下不存在，不能借详情接口伪装成真实课程。"""
    for demo_id in DEMO_COURSE_IDS:
        response = api_client.get(f"/api/v1/courses/{demo_id}")
        assert response.status_code == 404, f"{demo_id} 不应可读"


def test_demo_course_cannot_receive_learning_record(api_client) -> None:
    """演示课程不能写学习记录（课程不存在），真实课程可以。"""
    course_id, _ = _publish_course_with_video(api_client)

    rejected = api_client.put(
        "/api/v1/learning-records/course-anti-fraud", json={"progress_percent": 30}
    )
    assert rejected.status_code == 404

    accepted = api_client.put(
        f"/api/v1/learning-records/{course_id}", json={"progress_percent": 30}
    )
    assert accepted.status_code == 200
    assert accepted.json()["course_id"] == course_id


def test_course_and_video_survive_restart(api_client, tmp_path) -> None:
    """重启后课程与视频关联仍在：列表里还是那门课，详情还能播出视频。"""
    course_id, video_id = _publish_course_with_video(api_client)

    get_course_repository.cache_clear()
    restarted = TestClient(create_app())

    ids = {row["id"] for row in restarted.get("/api/v1/courses").json()}
    assert ids == {course_id}
    assert ids.isdisjoint(DEMO_COURSE_IDS)

    detail = restarted.get(f"/api/v1/courses/{course_id}").json()
    assert detail["video_url"] == f"/api/v1/course-videos/{video_id}"
    video = restarted.get(f"/api/v1/course-videos/{video_id}")
    assert video.status_code == 200
    assert video.content == b"wechat-video-bytes"


def test_mock_path_keeps_demo_courses(monkeypatch) -> None:
    """未配置数据库（mock / 内存路径）时，5 条演示课程仍在，与 API 模式互不影响。"""
    monkeypatch.delenv("ELDER_DATABASE_PATH", raising=False)
    get_course_repository.cache_clear()
    try:
        client = TestClient(create_app())
        ids = {row["id"] for row in client.get("/api/v1/courses").json()}
        assert DEMO_COURSE_IDS <= ids
    finally:
        get_course_repository.cache_clear()
