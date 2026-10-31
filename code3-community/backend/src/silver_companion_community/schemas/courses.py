from enum import Enum
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

NonEmptyText = Annotated[str, Field(min_length=1)]


class CourseStatus(str, Enum):
    """助老课程状态。"""

    published = "published"
    draft = "draft"
    offline = "offline"


class Course(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: NonEmptyText
    title: NonEmptyText
    category: NonEmptyText
    format: NonEmptyText
    # 展示文案（如「约 3 分钟」），不是数值时长
    duration_label: NonEmptyText
    note: NonEmptyText
    status: CourseStatus
    updated_at: AwareDatetime


class CourseStatusUpdate(BaseModel):
    """发布 published / 下架 offline。"""

    status: CourseStatus
