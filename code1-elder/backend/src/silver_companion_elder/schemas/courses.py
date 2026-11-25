from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

NonEmptyText = Annotated[str, Field(min_length=1)]


class CourseStatus(str, Enum):
    """课程发布状态；缺行/新建默认 published。"""

    published = "published"
    unpublished = "unpublished"


class CourseSummary(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: NonEmptyText
    title: NonEmptyText
    category: NonEmptyText
    description: NonEmptyText
    duration_seconds: Annotated[int, Field(strict=True, ge=0)]
    # 契约扩展：课程关联视频的播放地址；演示预置课程未上传视频时为 null
    video_url: str | None = None
    # 契约扩展：发布状态与是否允许社区端上下架（预置课程恒为 False）
    status: CourseStatus = CourseStatus.published
    editable: bool = False


class CourseDetail(CourseSummary):
    outline: list[NonEmptyText]


class CourseVideoUpload(BaseModel):
    """上传视频后的返回（契约扩展：社区端上传课程视频用）。"""

    video_id: str
    video_url: str


class CreateCourseRequest(BaseModel):
    """社区端创建课程请求（契约扩展：视频上传后建课用）。"""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: Annotated[str, Field(min_length=1, max_length=50)]
    category: Annotated[str, Field(min_length=1, max_length=20)]
    description: Annotated[str, Field(min_length=1, max_length=200)]
    duration_seconds: Annotated[int, Field(strict=True, ge=0)]
    outline: Annotated[list[NonEmptyText], Field(min_length=1, max_length=20)]
    video_id: Annotated[str | None, Field(min_length=1)] = None


class CoursePublicationUpdate(BaseModel):
    """上下架请求体；未知状态由 Pydantic 统一映射为 422。"""

    status: CourseStatus
