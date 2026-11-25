"""课程上下架持久化测试（2026-11-14 授权例外：course_publications 单表）。"""

import asyncio
import sqlite3
import threading

from silver_companion_elder.repositories.courses import InMemoryCourseRepository
from silver_companion_elder.repositories.sqlite_courses import SqliteCourseRepository
from silver_companion_elder.schemas.courses import CourseStatus, CreateCourseRequest


def run(coro):
    return asyncio.run(coro)


def make_request(title: str = "上下架自动化测试课程") -> CreateCourseRequest:
    return CreateCourseRequest(
        title=title,
        category="数字素养",
        description="自动化测试课程",
        duration_seconds=120,
        outline=["第一步"],
    )


def make_repository(tmp_path) -> SqliteCourseRepository:
    repository = SqliteCourseRepository(tmp_path / "courses.db")
    repository.initialize()
    return repository


def test_created_course_is_published_and_editable(tmp_path) -> None:
    repository = make_repository(tmp_path)
    created = run(repository.create_course(make_request()))

    assert created.status == CourseStatus.published
    assert created.editable is True


def test_publication_persists_across_repository_instances(tmp_path) -> None:
    path = tmp_path / "courses.db"
    first = SqliteCourseRepository(path)
    first.initialize()
    created = run(first.create_course(make_request()))
    hidden = run(
        first.set_publication(
            created.id, CourseStatus.unpublished, CourseStatus.published
        )
    )
    assert hidden is not None and hidden.status == CourseStatus.unpublished

    second = SqliteCourseRepository(path)
    second.initialize()
    assert created.id not in {course.id for course in run(second.list_courses())}
    listed = {
        course.id: course
        for course in run(second.list_courses(include_unpublished=True))
    }
    assert listed[created.id].status == CourseStatus.unpublished
    assert listed[created.id].editable is True
    assert run(second.get_course(created.id)) is None
    assert run(second.get_course(created.id, include_unpublished=True)) is not None

    restored = run(
        second.set_publication(
            created.id, CourseStatus.published, CourseStatus.unpublished
        )
    )
    assert restored is not None and restored.status == CourseStatus.published


def test_same_status_transition_is_rejected(tmp_path) -> None:
    repository = make_repository(tmp_path)
    created = run(repository.create_course(make_request()))

    assert (
        run(
            repository.set_publication(
                created.id, CourseStatus.published, CourseStatus.published
            )
        )
        is None
    )


def test_preset_course_is_always_published_and_not_editable(tmp_path) -> None:
    repository = make_repository(tmp_path)
    preset = run(repository.get_course("course-smartphone-basics"))
    assert preset is not None
    assert preset.status == CourseStatus.published
    assert preset.editable is False
    assert (
        run(
            repository.set_publication(
                "course-smartphone-basics",
                CourseStatus.unpublished,
                CourseStatus.published,
            )
        )
        is None
    )
    assert run(repository.get_course("course-smartphone-basics")).status == CourseStatus.published


def test_unknown_course_publication_returns_none(tmp_path) -> None:
    repository = make_repository(tmp_path)

    assert (
        run(
            repository.set_publication(
                "course-ghost", CourseStatus.unpublished, CourseStatus.published
            )
        )
        is None
    )


def test_existing_database_defaults_courses_to_published(tmp_path) -> None:
    path = tmp_path / "legacy.db"
    connection = sqlite3.connect(path)
    connection.execute(
        """
        CREATE TABLE courses (
            id TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            duration_seconds INTEGER NOT NULL,
            outline_json TEXT NOT NULL,
            video_url TEXT
        )
        """
    )
    connection.execute(
        "INSERT INTO courses VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("course-legacy", "旧库课程", "数字素养", "旧库已有课程", 60, '["第一步"]', None),
    )
    connection.commit()
    connection.close()

    repository = SqliteCourseRepository(path)
    repository.initialize()
    course = run(repository.get_course("course-legacy"))

    assert course is not None
    assert course.status == CourseStatus.published
    assert course.editable is True


def test_in_memory_publication_matches_sqlite_semantics() -> None:
    repository = InMemoryCourseRepository()
    created = run(repository.create_course(make_request()))
    assert created.status == CourseStatus.published
    assert created.editable is True
    assert (
        run(
            repository.set_publication(
                created.id, CourseStatus.published, CourseStatus.published
            )
        )
        is None
    )

    hidden = run(
        repository.set_publication(
            created.id, CourseStatus.unpublished, CourseStatus.published
        )
    )
    assert hidden is not None and hidden.status == CourseStatus.unpublished
    assert created.id not in {course.id for course in run(repository.list_courses())}
    assert created.id in {
        course.id for course in run(repository.list_courses(include_unpublished=True))
    }
    assert run(repository.get_course(created.id)) is None
    assert (
        run(
            repository.set_publication(
                created.id, CourseStatus.published, CourseStatus.published
            )
        )
        is None
    )
    restored = run(
        repository.set_publication(
            created.id, CourseStatus.published, CourseStatus.unpublished
        )
    )
    assert restored is not None and restored.status == CourseStatus.published


def test_concurrent_unpublish_only_one_wins(tmp_path) -> None:
    path = tmp_path / "race.db"
    repository = SqliteCourseRepository(path)
    repository.initialize()
    created = run(repository.create_course(make_request()))
    barrier = threading.Barrier(2)
    results: list[object] = []

    def contend() -> None:
        contender = SqliteCourseRepository(path)
        barrier.wait()
        results.append(
            run(
                contender.set_publication(
                    created.id, CourseStatus.unpublished, CourseStatus.published
                )
            )
        )

    threads = [threading.Thread(target=contend) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert len(results) == 2
    assert sum(result is not None for result in results) == 1
