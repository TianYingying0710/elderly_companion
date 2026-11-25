from pathlib import Path
from typing import Protocol, Sequence

from fastapi import UploadFile

from silver_companion_elder.schemas.courses import (
    CourseDetail,
    CourseStatus,
    CourseSummary,
    CreateCourseRequest,
)
from silver_companion_elder.schemas.learning import LearningRecord
from silver_companion_elder.schemas.sos_events import (
    SosEvent,
    SosEventCreate,
    SosEventStatus,
)


class CourseRepository(Protocol):
    """课程/视频/学习记录仓库契约：内存实现与 SQLite 持久化实现共同遵守。"""

    def reset(self) -> None: ...
    async def create_course(self, request: CreateCourseRequest) -> CourseDetail: ...
    async def save_video(
        self, file: UploadFile, max_bytes: int, chunk_size: int
    ) -> tuple[str, str]: ...
    def get_video_path(self, video_id: str) -> Path | None: ...
    async def list_courses(
        self, include_unpublished: bool = False
    ) -> list[CourseSummary]: ...
    async def get_course(
        self, course_id: str, include_unpublished: bool = False
    ) -> CourseDetail | None: ...
    async def set_publication(
        self,
        course_id: str,
        status: CourseStatus,
        expected_status: CourseStatus,
    ) -> CourseDetail | None: ...
    async def list_records(self) -> list[LearningRecord]: ...
    async def upsert_record(
        self, course_id: str, progress_percent: int
    ) -> LearningRecord | None: ...


class SosEventRepository(Protocol):
    """SOS 事件仓库契约：内存实现与 SQLite 持久化实现共同遵守。"""

    async def create(self, payload: SosEventCreate) -> SosEvent: ...
    async def list(self, elder_id: str | None = None) -> Sequence[SosEvent]: ...
    async def get(self, event_id: str) -> SosEvent | None: ...
    async def update_status(
        self,
        event_id: str,
        status: SosEventStatus,
        expected_status: SosEventStatus,
        note: str | None = None,
    ) -> SosEvent | None: ...


class LearningRecordRepository(Protocol):
    async def list_records(self) -> Sequence[LearningRecord]: ...
    async def save_progress(self, course_id: str, progress_percent: int) -> LearningRecord: ...
