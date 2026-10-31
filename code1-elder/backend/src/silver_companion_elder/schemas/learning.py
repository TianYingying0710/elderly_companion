from datetime import datetime
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

NonEmptyText = Annotated[str, Field(min_length=1)]
ProgressPercent = Annotated[int, Field(strict=True, ge=0, le=100)]


class LearningProgressUpdate(BaseModel):
    progress_percent: ProgressPercent


class LearningRecord(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    course_id: NonEmptyText
    progress_percent: ProgressPercent
    updated_at: AwareDatetime
