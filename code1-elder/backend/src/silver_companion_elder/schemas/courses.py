from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

NonEmptyText = Annotated[str, Field(min_length=1)]


class CourseSummary(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: NonEmptyText
    title: NonEmptyText
    category: NonEmptyText
    description: NonEmptyText
    duration_seconds: Annotated[int, Field(strict=True, ge=0)]


class CourseDetail(CourseSummary):
    outline: list[NonEmptyText]
