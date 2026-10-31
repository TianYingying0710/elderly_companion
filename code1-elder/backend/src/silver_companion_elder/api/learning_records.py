from typing import Annotated

from fastapi import APIRouter, Path

from silver_companion_elder.dependencies.capabilities import capability_not_implemented
from silver_companion_elder.schemas.learning import LearningProgressUpdate, LearningRecord

router = APIRouter(prefix="/learning-records", tags=["learning-records"])
not_implemented = {501: {"description": "该业务能力尚未接入"}}
CourseId = Annotated[str, Path(min_length=1, pattern=r".*\S.*")]


@router.get("", response_model=list[LearningRecord], responses=not_implemented)
async def list_learning_records() -> list[LearningRecord]:
    capability_not_implemented()


@router.put("/{course_id}", response_model=LearningRecord, responses=not_implemented)
async def update_learning_record(
    course_id: CourseId, update: LearningProgressUpdate
) -> LearningRecord:
    capability_not_implemented()
