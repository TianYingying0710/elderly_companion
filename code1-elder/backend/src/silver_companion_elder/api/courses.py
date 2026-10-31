from typing import Annotated

from fastapi import APIRouter, Path

from silver_companion_elder.dependencies.capabilities import capability_not_implemented
from silver_companion_elder.schemas.courses import CourseDetail, CourseSummary

router = APIRouter(prefix="/courses", tags=["courses"])
not_implemented = {501: {"description": "该业务能力尚未接入"}}
CourseId = Annotated[str, Path(min_length=1, pattern=r".*\S.*")]


@router.get("", response_model=list[CourseSummary], responses=not_implemented)
async def list_courses() -> list[CourseSummary]:
    capability_not_implemented()


@router.get("/{course_id}", response_model=CourseDetail, responses=not_implemented)
async def get_course(course_id: CourseId) -> CourseDetail:
    capability_not_implemented()
