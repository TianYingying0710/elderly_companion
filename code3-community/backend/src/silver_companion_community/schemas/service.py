from enum import Enum
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

NonEmptyText = Annotated[str, Field(min_length=1)]


class ServiceStatus(str, Enum):
    """社区服务 3 态。"""

    pending = "pending"
    in_service = "in_service"
    completed = "completed"


class ServiceTask(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: NonEmptyText
    title: NonEmptyText
    elder_name: NonEmptyText
    category: NonEmptyText
    scheduled_at: AwareDatetime
    location: NonEmptyText
    description: NonEmptyText
    status: ServiceStatus
    # 服务记录：推进到 completed 时写入
    note: str | None = None


class ServiceTransition(BaseModel):
    """推进一步。完成服务必须留下服务记录。"""

    model_config = ConfigDict(str_strip_whitespace=True)

    to: ServiceStatus
    note: str | None = None

    @model_validator(mode="after")
    def completed_requires_note(self) -> "ServiceTransition":
        if self.to is ServiceStatus.completed and not self.note:
            raise ValueError("完成服务前必须填写服务记录")
        return self
