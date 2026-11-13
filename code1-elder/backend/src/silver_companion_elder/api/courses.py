from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from silver_companion_elder.errors import (
    CourseNotFoundError,
    CourseNotEditableError,
    IllegalCoursePublicationError,
)
from silver_companion_elder.repositories.courses import get_course_repository
from silver_companion_elder.repositories.protocols import CourseRepository
from silver_companion_elder.schemas.courses import (
    CourseDetail,
    CoursePublicationUpdate,
    CourseSummary,
    CreateCourseRequest,
)

router = APIRouter(prefix="/courses", tags=["courses"])
CourseId = Annotated[str, Path(min_length=1, pattern=r".*\S.*")]
IncludeUnpublished = Annotated[bool, Query()]
error_responses = {404: {"description": "课程不存在"}}
publication_error_responses = {
    404: {"description": "课程不存在"},
    409: {"description": "预置课程不可上下架或状态重复变更"},
}


@router.get("", response_model=list[CourseSummary])
async def list_courses(
    repository: Annotated[CourseRepository, Depends(get_course_repository)],
    include_unpublished: IncludeUnpublished = False,
) -> list[CourseSummary]:
    return await repository.list_courses(include_unpublished=include_unpublished)


@router.post("", response_model=CourseDetail, status_code=201, responses=error_responses)
async def create_course(
    request: CreateCourseRequest,
    repository: Annotated[CourseRepository, Depends(get_course_repository)],
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
    repository: Annotated[CourseRepository, Depends(get_course_repository)],
) -> CourseDetail:
    course = await repository.get_course(course_id)
    if course is None:
        raise CourseNotFoundError
    return course


# 微信小程序 uni.request 不支持 PATCH：上下架统一走 POST 子资源。
@router.post(
    "/{course_id}/publication",
    response_model=CourseDetail,
    responses=publication_error_responses,
)
async def update_course_publication(
    course_id: CourseId,
    payload: CoursePublicationUpdate,
    repository: Annotated[CourseRepository, Depends(get_course_repository)],
) -> CourseDetail:
    course = await repository.get_course(course_id, include_unpublished=True)
    if course is None:
        raise CourseNotFoundError
    if not course.editable:
        raise CourseNotEditableError
    if course.status == payload.status:
        raise IllegalCoursePublicationError
    updated = await repository.set_publication(
        course_id, payload.status, expected_status=course.status
    )
    if updated is None:
        raise IllegalCoursePublicationError
    return updated
