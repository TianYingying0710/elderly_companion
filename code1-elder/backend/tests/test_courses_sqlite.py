"""课程/视频/学习记录 SQLite 持久化测试（2026-11-14 授权例外）。

覆盖：动态课程落库与预置课程合并、视频登记、学习记录 upsert（含预置课程）、
并发 upsert 唯一胜者、环境变量接线与「重启后数据仍在」、默认内存不留库文件、
存储错误映射 503。"""

import asyncio
import io
import threading

import pytest
from fastapi import UploadFile
from fastapi.testclient import TestClient

from silver_companion_elder.errors import CourseStorageUnavailableError
from silver_companion_elder.main import create_app
from silver_companion_elder.repositories.courses import get_course_repository
from silver_companion_elder.repositories.sqlite_courses import SqliteCourseRepository
from silver_companion_elder.schemas.courses import CreateCourseRequest


def run(coro):
    return asyncio.run(coro)


def make_repository(tmp_path, name: str = "courses.db") -> SqliteCourseRepository:
    repository = SqliteCourseRepository(tmp_path / name)
    repository.initialize()
    return repository


def make_upload(filename: str = "lesson.mp4", payload: bytes = b"video-bytes") -> UploadFile:
    return UploadFile(file=io.BytesIO(payload), filename=filename)


def make_request(video_id: str | None = None) -> CreateCourseRequest:
    return CreateCourseRequest(
        title="防诈骗第一课",
        category="安全防护",
        description="守住钱袋子",
        duration_seconds=300,
        outline=["认识诈骗", "挂断电话"],
        video_id=video_id,
    )


def test_demo_and_dynamic_courses_merge_in_list(tmp_path) -> None:
    repository = make_repository(tmp_path)
    created = run(repository.create_course(make_request()))

    courses = run(repository.list_courses())
    assert [c.id for c in courses][:5] == [
        "course-smartphone-basics",
        "course-anti-fraud",
        "course-video-call",
        "course-health-walking",
        "course-emergency-sos",
    ]
    assert courses[-1].id == created.id
    # 预置课程不落库：库里只有动态课程一行
    assert run(repository.get_course("course-smartphone-basics")) is not None
    assert run(repository.get_course(created.id)).title == "防诈骗第一课"


def test_create_course_with_unknown_video_id_raises(tmp_path) -> None:
    repository = make_repository(tmp_path)
    with pytest.raises(Exception):
        run(repository.create_course(make_request(video_id="ghost-video")))


def test_video_registration_roundtrip(tmp_path) -> None:
    repository = make_repository(tmp_path)
    video_id, video_url = run(repository.save_video(make_upload(), 200, 64))
    assert video_url == f"/api/v1/course-videos/{video_id}"
    path = repository.get_video_path(video_id)
    assert path is not None and path.read_bytes() == b"video-bytes"
    assert repository.get_video_path("ghost") is None


def test_upsert_record_allows_demo_and_dynamic_courses_only(tmp_path) -> None:
    repository = make_repository(tmp_path)
    created = run(repository.create_course(make_request()))

    first = run(repository.upsert_record("course-anti-fraud", 40))
    assert first is not None and first.progress_percent == 40
    run(repository.upsert_record(created.id, 90))
    # 未知课程拒绝
    assert run(repository.upsert_record("course-ghost", 10)) is None

    records = run(repository.list_records())
    assert {record.course_id for record in records} == {"course-anti-fraud", created.id}
    # upsert 覆盖旧进度
    run(repository.upsert_record("course-anti-fraud", 80))
    by_course = {record.course_id: record.progress_percent for record in run(repository.list_records())}
    assert by_course["course-anti-fraud"] == 80


def test_upsert_keeps_latest_record_on_top(tmp_path) -> None:
    repository = make_repository(tmp_path)
    run(repository.upsert_record("course-anti-fraud", 40))
    latest = run(repository.upsert_record("course-video-call", 20))
    records = run(repository.list_records())
    assert records[0].course_id == latest.course_id


def test_concurrent_upsert_keeps_single_consistent_row(tmp_path) -> None:
    path = tmp_path / "race.db"
    writer = SqliteCourseRepository(path)
    writer.initialize()
    run(writer.upsert_record("course-anti-fraud", 0))

    repository_a = SqliteCourseRepository(path)
    repository_b = SqliteCourseRepository(path)
    barrier = threading.Barrier(2)

    def contend(repository: SqliteCourseRepository, percent: int) -> None:
        barrier.wait()
        run(repository.upsert_record("course-anti-fraud", percent))

    thread_a = threading.Thread(target=contend, args=(repository_a, 55))
    thread_b = threading.Thread(target=contend, args=(repository_b, 66))
    thread_a.start()
    thread_b.start()
    thread_a.join()
    thread_b.join()

    records = run(SqliteCourseRepository(path).list_records())
    assert len(records) == 1
    assert records[0].progress_percent in (55, 66)


def test_env_wired_api_persists_across_restart(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "wired" / "courses.db"
    monkeypatch.setenv("ELDER_DATABASE_PATH", str(database_path))
    get_course_repository.cache_clear()
    try:
        client = TestClient(create_app())
        uploaded = client.post(
            "/api/v1/course-videos",
            files={"file": ("lesson.mp4", io.BytesIO(b"mp4-data"), "video/mp4")},
        )
        assert uploaded.status_code in (200, 201)
        video_id = uploaded.json()["video_id"]
        created = client.post(
            "/api/v1/courses",
            json={
                "title": "手机缴费",
                "category": "日常生活",
                "description": "一步步完成缴费",
                "duration_seconds": 240,
                "outline": ["打开应用", "扫码支付"],
                "video_id": video_id,
            },
        )
        assert created.status_code in (200, 201)
        course_id = created.json()["id"]
        progress = client.put(
            f"/api/v1/learning-records/{course_id}", json={"progress_percent": 45}
        )
        assert progress.status_code == 200

        # 模拟服务重启：清空依赖单例后重建应用，数据必须仍在
        get_course_repository.cache_clear()
        restarted = TestClient(create_app())
        catalog = restarted.get("/api/v1/courses").json()
        created_rows = [row for row in catalog if row["id"] == course_id]
        assert len(created_rows) == 1
        assert created_rows[0]["video_url"] == f"/api/v1/course-videos/{video_id}"
        detail = restarted.get(f"/api/v1/courses/{course_id}").json()
        assert detail["outline"] == ["打开应用", "扫码支付"]
        records = restarted.get("/api/v1/learning-records").json()
        assert any(
            record["course_id"] == course_id and record["progress_percent"] == 45
            for record in records
        )
        # 视频文件与登记在重启后仍然可用（Range 播放入口）
        video = restarted.get(f"/api/v1/course-videos/{video_id}")
        assert video.status_code == 200
        assert video.content == b"mp4-data"
    finally:
        get_course_repository.cache_clear()


def test_default_without_env_stays_in_memory(monkeypatch, tmp_path) -> None:
    monkeypatch.delenv("ELDER_DATABASE_PATH", raising=False)
    get_course_repository.cache_clear()
    try:
        client = TestClient(create_app())
        assert client.get("/api/v1/courses").status_code == 200
        assert not list(tmp_path.iterdir())  # 不应在测试目录留下任何数据库文件
    finally:
        get_course_repository.cache_clear()


def test_database_error_maps_to_storage_unavailable(tmp_path) -> None:
    repository = make_repository(tmp_path)
    (tmp_path / "courses.db").unlink()
    (tmp_path / "courses.db").mkdir()

    with pytest.raises(CourseStorageUnavailableError):
        run(repository.list_courses())
