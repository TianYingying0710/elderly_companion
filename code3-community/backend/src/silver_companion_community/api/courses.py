from fastapi import APIRouter

from silver_companion_community.dependencies.capabilities import capability_not_implemented
from silver_companion_community.schemas.courses import Course, CourseStatus, CourseStatusUpdate

from .params import PageLimit, ResourceId

router = APIRouter(prefix="/courses", tags=["courses"])

NOT_IMPLEMENTED = {501: {"description": "该业务能力尚未接入"}}
NOT_FOUND = {404: {"description": "课程不存在"}}


@router.get("", response_model=list[Course], responses=NOT_IMPLEMENTED)
async def list_courses(
    category: str | None = None,
    status: CourseStatus | None = None,
    limit: PageLimit = 20,
) -> list[Course]:
    """助老课程列表，可按分类与状态过滤。"""
    capability_not_implemented()


@router.get(
    "/{course_id}",
    response_model=Course,
    responses={**NOT_IMPLEMENTED, **NOT_FOUND},
)
async def get_course(course_id: ResourceId) -> Course:
    """单门课程详情。"""
    capability_not_implemented()


@router.patch(
    "/{course_id}",
    response_model=Course,
    responses={**NOT_IMPLEMENTED, **NOT_FOUND},
)
async def update_course_status(course_id: ResourceId, update: CourseStatusUpdate) -> Course:
    """发布 published / 下架 offline。"""
    capability_not_implemented()
