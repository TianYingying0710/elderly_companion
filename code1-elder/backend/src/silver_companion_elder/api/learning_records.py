from typing import Annotated

from fastapi import APIRouter, Depends, Path

from silver_companion_elder.errors import CourseNotFoundError
from silver_companion_elder.repositories.courses import (
    InMemoryCourseRepository,
    get_course_repository,
)
from silver_companion_elder.schemas.learning import LearningRecord, LearningProgressUpdate

router = APIRouter(prefix="/learning-records", tags=["learning-records"])
CourseId = Annotated[str, Path(min_length=1, pattern=r".*\S.*")]
error_responses = {404: {"description": "课程不存在"}}


@router.get("", response_model=list[LearningRecord])
async def list_learning_records(
    repository: Annotated[InMemoryCourseRepository, Depends(get_course_repository)],
) -> list[LearningRecord]:
    return await repository.list_records()


@router.put("/{course_id}", response_model=LearningRecord, responses=error_responses)
async def update_learning_record(
    course_id: CourseId,
    update: LearningProgressUpdate,
    repository: Annotated[InMemoryCourseRepository, Depends(get_course_repository)],
) -> LearningRecord:
    record = await repository.upsert_record(course_id, update.progress_percent)
    if record is None:
        raise CourseNotFoundError
    return record
