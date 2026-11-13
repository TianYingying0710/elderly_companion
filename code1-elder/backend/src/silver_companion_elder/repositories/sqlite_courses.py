"""课程/视频/学习记录 SQLite 持久化实现（2026-11-14 用户授权例外，模式与 SOS 仓库一致）。

三张表共用一个数据库文件（`ELDER_DATABASE_PATH`），只 `CREATE TABLE IF NOT EXISTS`：
- courses：仅存社区端动态课程；预置演示课程不落库，读取时在内存层合并（避免 seed）。
- course_videos：video_id → 磁盘文件路径登记；文件本体仍在 data/uploads/videos/。
- learning_records：course_id 主键 upsert，course_id 可以是预置或动态课程。
所有 `sqlite3.Error` 统一翻译为 `CourseStorageUnavailableError`（HTTP 503）。
"""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from silver_companion_elder.errors import (
    CourseNotFoundError,
    CourseStorageUnavailableError,
)
from silver_companion_elder.repositories.courses import (
    VIDEO_STORAGE_DIR,
    _demo_courses,
)
from silver_companion_elder.schemas.courses import (
    CourseDetail,
    CourseSummary,
    CreateCourseRequest,
)
from silver_companion_elder.schemas.learning import LearningRecord

CREATE_COURSES_SQL = """
CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    outline_json TEXT NOT NULL,
    video_url TEXT
)
"""

CREATE_COURSE_VIDEOS_SQL = """
CREATE TABLE IF NOT EXISTS course_videos (
    video_id TEXT PRIMARY KEY NOT NULL,
    file_path TEXT NOT NULL
)
"""

CREATE_LEARNING_RECORDS_SQL = """
CREATE TABLE IF NOT EXISTS learning_records (
    course_id TEXT PRIMARY KEY NOT NULL,
    progress_percent INTEGER NOT NULL,
    updated_at TEXT NOT NULL
)
"""

UPSERT_RECORD_SQL = """
INSERT INTO learning_records (course_id, progress_percent, updated_at)
VALUES (?, ?, ?)
ON CONFLICT(course_id)
DO UPDATE SET progress_percent = excluded.progress_percent,
              updated_at = excluded.updated_at
"""


class SqliteCourseRepository:
    def __init__(self, database_path: str | Path) -> None:
        self._database_path = str(database_path)
        self._demo = _demo_courses()

    def initialize(self) -> None:
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(CREATE_COURSES_SQL)
            connection.execute(CREATE_COURSE_VIDEOS_SQL)
            connection.execute(CREATE_LEARNING_RECORDS_SQL)
            connection.commit()
        except sqlite3.Error as error:
            connection.rollback()
            raise CourseStorageUnavailableError("failed to initialize course tables") from error
        finally:
            connection.close()

    def reset(self) -> None:
        """测试辅助：清空学习记录，与内存实现语义一致（不动课程与视频登记）。"""
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute("DELETE FROM learning_records")
            connection.commit()
        except sqlite3.Error as error:
            connection.rollback()
            raise CourseStorageUnavailableError("failed to reset learning records") from error
        finally:
            connection.close()

    async def create_course(self, request: CreateCourseRequest) -> CourseDetail:
        video_url = None
        if request.video_id is not None and not self._video_exists(request.video_id):
            raise CourseNotFoundError
        if request.video_id is not None:
            video_url = f"/api/v1/course-videos/{request.video_id}"
        course_id = f"course-{uuid4().hex[:12]}"
        course = CourseDetail(
            id=course_id,
            title=request.title,
            category=request.category,
            description=request.description,
            duration_seconds=request.duration_seconds,
            outline=list(request.outline),
            video_url=video_url,
        )
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(
                "INSERT INTO courses (id, title, category, description, duration_seconds, outline_json, video_url)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    course.id,
                    course.title,
                    course.category,
                    course.description,
                    course.duration_seconds,
                    json.dumps(course.outline, ensure_ascii=False),
                    course.video_url,
                ),
            )
            connection.commit()
        except sqlite3.Error as error:
            connection.rollback()
            raise CourseStorageUnavailableError("failed to save course") from error
        finally:
            connection.close()
        return course

    async def save_video(
        self, file: UploadFile, max_bytes: int, chunk_size: int
    ) -> tuple[str, str]:
        """分块落盘上传视频并把 video_id → 路径登记进库，超出上限即中止并清理半成品。"""
        VIDEO_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        video_id = uuid4().hex[:12]
        target = VIDEO_STORAGE_DIR / f"{video_id}.mp4"
        written = 0
        try:
            with target.open("wb") as sink:
                while chunk := await file.read(chunk_size):
                    written += len(chunk)
                    if written > max_bytes:
                        raise ValueError("视频超出 200MB 上限")
                    sink.write(chunk)
        except BaseException:
            target.unlink(missing_ok=True)
            raise
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(
                "INSERT INTO course_videos (video_id, file_path) VALUES (?, ?)",
                (video_id, str(target)),
            )
            connection.commit()
        except sqlite3.Error as error:
            connection.rollback()
            target.unlink(missing_ok=True)
            raise CourseStorageUnavailableError("failed to register course video") from error
        finally:
            connection.close()
        return video_id, f"/api/v1/course-videos/{video_id}"

    def get_video_path(self, video_id: str) -> Path | None:
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT file_path FROM course_videos WHERE video_id = ?", (video_id,)
            ).fetchone()
        except sqlite3.Error as error:
            raise CourseStorageUnavailableError("failed to read course video") from error
        finally:
            connection.close()
        return None if row is None else Path(row["file_path"])

    async def list_courses(self) -> list[CourseSummary]:
        connection = self._connect()
        try:
            rows = connection.execute(
                "SELECT * FROM courses ORDER BY rowid ASC"
            ).fetchall()
        except sqlite3.Error as error:
            raise CourseStorageUnavailableError("failed to list courses") from error
        finally:
            connection.close()
        summaries = [
            CourseSummary(
                id=course.id,
                title=course.title,
                category=course.category,
                description=course.description,
                duration_seconds=course.duration_seconds,
                video_url=course.video_url,
            )
            for course in self._demo.values()
        ]
        summaries.extend(
            CourseSummary(
                id=row["id"],
                title=row["title"],
                category=row["category"],
                description=row["description"],
                duration_seconds=row["duration_seconds"],
                video_url=row["video_url"],
            )
            for row in rows
        )
        return summaries

    async def get_course(self, course_id: str) -> CourseDetail | None:
        demo = self._demo.get(course_id)
        if demo is not None:
            return demo
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT * FROM courses WHERE id = ?", (course_id,)
            ).fetchone()
        except sqlite3.Error as error:
            raise CourseStorageUnavailableError("failed to read course") from error
        finally:
            connection.close()
        if row is None:
            return None
        return CourseDetail(
            id=row["id"],
            title=row["title"],
            category=row["category"],
            description=row["description"],
            duration_seconds=row["duration_seconds"],
            outline=json.loads(row["outline_json"]),
            video_url=row["video_url"],
        )

    async def list_records(self) -> list[LearningRecord]:
        connection = self._connect()
        try:
            rows = connection.execute(
                "SELECT * FROM learning_records ORDER BY updated_at DESC"
            ).fetchall()
        except sqlite3.Error as error:
            raise CourseStorageUnavailableError("failed to list learning records") from error
        finally:
            connection.close()
        return [
            LearningRecord(
                course_id=row["course_id"],
                progress_percent=row["progress_percent"],
                updated_at=datetime.fromisoformat(row["updated_at"]),
            )
            for row in rows
        ]

    async def upsert_record(self, course_id: str, progress_percent: int) -> LearningRecord | None:
        if course_id not in self._demo and not self._course_exists(course_id):
            return None
        record = LearningRecord(
            course_id=course_id,
            progress_percent=progress_percent,
            updated_at=datetime.now(timezone.utc),
        )
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(
                UPSERT_RECORD_SQL,
                (record.course_id, record.progress_percent, record.updated_at.isoformat()),
            )
            connection.commit()
        except sqlite3.Error as error:
            connection.rollback()
            raise CourseStorageUnavailableError("failed to save learning record") from error
        finally:
            connection.close()
        return record

    def _video_exists(self, video_id: str) -> bool:
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT 1 FROM course_videos WHERE video_id = ?", (video_id,)
            ).fetchone()
        except sqlite3.Error as error:
            raise CourseStorageUnavailableError("failed to check course video") from error
        finally:
            connection.close()
        return row is not None

    def _course_exists(self, course_id: str) -> bool:
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT 1 FROM courses WHERE id = ?", (course_id,)
            ).fetchone()
        except sqlite3.Error as error:
            raise CourseStorageUnavailableError("failed to check course") from error
        finally:
            connection.close()
        return row is not None

    def _connect(self) -> sqlite3.Connection:
        try:
            connection = sqlite3.connect(self._database_path)
        except sqlite3.Error as error:
            raise CourseStorageUnavailableError("course storage is unavailable") from error
        connection.row_factory = sqlite3.Row
        return connection
