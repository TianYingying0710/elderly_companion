"""课程/视频/学习记录 SQLite 持久化测试（2026-11-14 授权例外）。

覆盖：SQLite 路径**只返回社区端真实课程**（5 条演示课程不得出现在 API 结果里）、
动态课程落库与视频关联、学习记录 upsert、并发 upsert 唯一胜者、
环境变量接线与「重启后课程与视频关联仍在」、默认内存不留库文件、存储错误映射 503。"""

import asyncio
import io
import threading

import pytest
from fastapi import UploadFile
from fastapi.testclient import TestClient

from silver_companion_elder.errors import CourseStorageUnavailableError
from silver_companion_elder.main import create_app
from silver_companion_elder.repositories.courses import get_course_repository
from silver_companion_elder.repositories import courses as courses_repository
from silver_companion_elder.repositories import sqlite_courses
from silver_companion_elder.repositories.sqlite_courses import SqliteCourseRepository
from silver_companion_elder.schemas.courses import CourseStatus, CreateCourseRequest

# 5 条硬编码演示课程的 id：只允许出现在 mock / 内存路径，SQLite（API 模式）不得返回。
DEMO_COURSE_IDS = {
    "course-smartphone-basics",
    "course-anti-fraud",
    "course-video-call",
    "course-health-walking",
    "course-emergency-sos",
}


@pytest.fixture(autouse=True)
def isolated_video_dir(tmp_path, monkeypatch):
    """上传用例产生的 mp4 只写进 tmp_path，不落到仓库真实的 data/uploads/videos/。

    否则每跑一次测试就在真实上传目录里多留一个孤儿视频（既不删也不好追溯）。
    """
    video_dir = tmp_path / "uploads" / "videos"
    monkeypatch.setattr(sqlite_courses, "VIDEO_STORAGE_DIR", video_dir)
    monkeypatch.setattr(courses_repository, "VIDEO_STORAGE_DIR", video_dir)
    yield


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


def test_sqlite_list_contains_only_created_course(tmp_path) -> None:
    repository = make_repository(tmp_path)
    created = run(repository.create_course(make_request()))

    courses = run(repository.list_courses())
    ids = [c.id for c in courses]
    # 演示课程在 SQLite 路径下不注入：列表里只有社区端真实落库的课程
    assert ids == [created.id]
    assert ids[0].startswith("course-")
    assert run(repository.get_course(created.id)).title == "防诈骗第一课"


def test_sqlite_list_excludes_five_demo_courses(tmp_path) -> None:
    """API 列表不得包含 5 条硬编码演示课程（两套课程彻底分离）。"""
    repository = make_repository(tmp_path)
    run(repository.create_course(make_request()))

    ids = {c.id for c in run(repository.list_courses())}
    assert ids.isdisjoint(DEMO_COURSE_IDS)
    for demo_id in DEMO_COURSE_IDS:
        assert run(repository.get_course(demo_id)) is None


def test_sqlite_list_returns_only_published_real_courses(tmp_path) -> None:
    repository = make_repository(tmp_path)
    first = run(repository.create_course(make_request()))
    second = run(repository.create_course(make_request()))

    listed = {c.id for c in run(repository.list_courses())}
    assert listed == {first.id, second.id}
    # 下架后的课程默认不可见，但 include_unpublished 仍能取到
    assert run(repository.set_publication(second.id, CourseStatus.unpublished, CourseStatus.published))
    assert {c.id for c in run(repository.list_courses())} == {first.id}
    assert {c.id for c in run(repository.list_courses(include_unpublished=True))} == {
        first.id,
        second.id,
    }


def test_sqlite_detail_carries_video_url(tmp_path) -> None:
    """真实课程详情必须带回视频地址，前端据此渲染播放器。"""
    repository = make_repository(tmp_path)
    video_id, _ = run(repository.save_video(make_upload(), 200, 64))
    created = run(repository.create_course(make_request(video_id=video_id)))

    detail = run(repository.get_course(created.id))
    assert detail is not None
    assert detail.video_url == f"/api/v1/course-videos/{video_id}"
    assert repository.get_video_path(video_id) is not None


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


def test_upsert_record_allows_real_courses_only(tmp_path) -> None:
    repository = make_repository(tmp_path)
    created = run(repository.create_course(make_request()))

    # 演示课程在 SQLite 路径下不存在 → 学习记录拒绝写入
    assert run(repository.upsert_record("course-anti-fraud", 40)) is None
    run(repository.upsert_record(created.id, 90))
    # 未知课程同样拒绝
    assert run(repository.upsert_record("course-ghost", 10)) is None

    records = run(repository.list_records())
    assert {record.course_id for record in records} == {created.id}
    # upsert 覆盖旧进度
    run(repository.upsert_record(created.id, 80))
    by_course = {record.course_id: record.progress_percent for record in run(repository.list_records())}
    assert by_course[created.id] == 80


def test_upsert_keeps_latest_record_on_top(tmp_path) -> None:
    repository = make_repository(tmp_path)
    run(repository.upsert_record(run(repository.create_course(make_request())).id, 40))
    latest = run(repository.upsert_record(run(repository.create_course(make_request())).id, 20))
    records = run(repository.list_records())
    assert records[0].course_id == latest.course_id


def test_concurrent_upsert_keeps_single_consistent_row(tmp_path) -> None:
    path = tmp_path / "race.db"
    writer = SqliteCourseRepository(path)
    writer.initialize()
    course_id = run(writer.create_course(make_request())).id
    run(writer.upsert_record(course_id, 0))

    repository_a = SqliteCourseRepository(path)
    repository_b = SqliteCourseRepository(path)
    barrier = threading.Barrier(2)

    def contend(repository: SqliteCourseRepository, percent: int) -> None:
        barrier.wait()
        run(repository.upsert_record(course_id, percent))

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
        course_ids = {row["id"] for row in catalog}
        # 重启后：真实课程在，5 条演示课程不在
        assert course_ids == {course_id}
        assert course_ids.isdisjoint(DEMO_COURSE_IDS)
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
    """未设 ELDER_DATABASE_PATH → 内存实现，5 条演示课程仍可读（mock 路径的兜底）。"""
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
