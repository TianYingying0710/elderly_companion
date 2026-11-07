from typing import Annotated

from fastapi import APIRouter, Depends, Path

from silver_companion_elder.errors import CourseNotFoundError
from silver_companion_elder.repositories.courses import (
    InMemoryCourseRepository,
    get_course_repository,
)
from silver_companion_elder.schemas.courses import (
    CourseDetail,
    CourseSummary,
    CreateCourseRequest,
)

router = APIRouter(prefix="/courses", tags=["courses"])
CourseId = Annotated[str, Path(min_length=1, pattern=r".*\S.*")]
error_responses = {404: {"description": "课程不存在"}}


@router.get("", response_model=list[CourseSummary])
async def list_courses(
    repository: Annotated[InMemoryCourseRepository, Depends(get_course_repository)],
) -> list[CourseSummary]:
    return await repository.list_courses()


@router.post("", response_model=CourseDetail, status_code=201, responses=error_responses)
async def create_course(
    request: CreateCourseRequest,
    repository: Annotated[InMemoryCourseRepository, Depends(get_course_repository)],
) -> CourseDetail:
    try:
        return await repository.create_course(request)
    except CourseNotFoundError:
        # video_id 校验失败归为请求校验错误（422），而不是资源 404
        from fastapi.exceptions import RequestValidationError

        raise RequestValidationError(
            errors=[
                {
                    "loc": ("body", "video_id"),
                    "msg": "视频不存在，请先上传视频",
                    "type": "value_error",
                }
            ]
        ) from None


@router.get("/{course_id}", response_model=CourseDetail, responses=error_responses)
async def get_course(
    course_id: CourseId,
    repository: Annotated[InMemoryCourseRepository, Depends(get_course_repository)],
) -> CourseDetail:
    course = await repository.get_course(course_id)
    if course is None:
        raise CourseNotFoundError
    return course
