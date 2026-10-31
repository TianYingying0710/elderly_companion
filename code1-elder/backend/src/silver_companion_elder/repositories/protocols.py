from typing import Protocol, Sequence

from silver_companion_elder.schemas.courses import CourseDetail, CourseSummary
from silver_companion_elder.schemas.learning import LearningRecord


class CourseRepository(Protocol):
    async def list_courses(self) -> Sequence[CourseSummary]: ...
    async def get_course(self, course_id: str) -> CourseDetail | None: ...


class LearningRecordRepository(Protocol):
    async def list_records(self) -> Sequence[LearningRecord]: ...
    async def save_progress(self, course_id: str, progress_percent: int) -> LearningRecord: ...
