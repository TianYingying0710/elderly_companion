from typing import Protocol, Sequence

from silver_companion_elder.schemas.courses import CourseDetail, CourseSummary
from silver_companion_elder.schemas.learning import LearningRecord
from silver_companion_elder.schemas.sos_events import (
    SosEvent,
    SosEventCreate,
    SosEventStatus,
)


class SosEventRepository(Protocol):
    """SOS 事件仓库契约：内存实现与 SQLite 持久化实现共同遵守。"""

    async def create(self, payload: SosEventCreate) -> SosEvent: ...
    async def list(self, elder_id: str | None = None) -> Sequence[SosEvent]: ...
    async def get(self, event_id: str) -> SosEvent | None: ...
    async def update_status(
        self, event_id: str, status: SosEventStatus, expected_status: SosEventStatus
    ) -> SosEvent | None: ...


class CourseRepository(Protocol):
    async def list_courses(self) -> Sequence[CourseSummary]: ...
    async def get_course(self, course_id: str) -> CourseDetail | None: ...


class LearningRecordRepository(Protocol):
    async def list_records(self) -> Sequence[LearningRecord]: ...
    async def save_progress(self, course_id: str, progress_percent: int) -> LearningRecord: ...
