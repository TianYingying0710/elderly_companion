from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

# 与监护人端健康契约一致的老人标识规则
ElderId = Annotated[str, Field(pattern=r"^[A-Za-z0-9_-]{1,64}$")]
SosEventStatus = Literal["pending", "processing", "resolved"]
# 求助备注：老人可留一句话，可为空；去除首尾空白
SosNote = Annotated[str, Field(min_length=1, max_length=200)]


class SosEventCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    elder_id: ElderId
    note: SosNote | None = None


class SosEvent(BaseModel):
    id: str
    elder_id: str
    created_at: str  # ISO 8601（UTC，带时区）
    status: SosEventStatus
    note: str | None


class SosEventStatusUpdate(BaseModel):
    status: SosEventStatus
