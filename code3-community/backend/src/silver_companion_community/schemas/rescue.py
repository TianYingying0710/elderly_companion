from enum import Enum
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

NonEmptyText = Annotated[str, Field(min_length=1)]


class RescueStatus(str, Enum):
    """社区处置 4 态。传输值用英文 code，中文文案由前端映射。"""

    pending = "pending"
    en_route = "en_route"
    arrived = "arrived"
    completed = "completed"


class RescueSource(str, Enum):
    """求助来源。实体按钮无法携带原因，只能标记为硬件求助。"""

    hardware_button = "hardware_button"
    app_request = "app_request"


class GuardianProgress(BaseModel):
    """监护人（家庭协同）在当前事件中的推进情况。"""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: NonEmptyText
    # 0 已通知 / 1 已查看 / 2 已联系老人
    stage: Annotated[int, Field(strict=True, ge=0, le=2)]
    times: list[AwareDatetime]
    feedback: NonEmptyText
    other_count: Annotated[int, Field(strict=True, ge=0)]


class RescueStep(BaseModel):
    """时间轴上的一步；未到达的步骤 happened_at 为空。"""

    model_config = ConfigDict(str_strip_whitespace=True)

    status: RescueStatus
    name: NonEmptyText
    happened_at: AwareDatetime | None = None


class RescueIncidentSummary(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: NonEmptyText
    elder_name: NonEmptyText
    source: RescueSource
    # 空串表示未携带原因
    reason: str = ""
    location: NonEmptyText
    status: RescueStatus
    reported_at: AwareDatetime

    @model_validator(mode="after")
    def hardware_button_cannot_carry_reason(self) -> "RescueIncidentSummary":
        if self.source is RescueSource.hardware_button and self.reason:
            raise ValueError("硬件求助不携带原因")
        return self


class RescueIncidentDetail(RescueIncidentSummary):
    guardian: GuardianProgress
    steps: list[RescueStep]
    result: str | None = None


class RescueTransition(BaseModel):
    """推进一步。进入终态必须填写处理结果。"""

    model_config = ConfigDict(str_strip_whitespace=True)

    to: RescueStatus
    result: str | None = None

    @model_validator(mode="after")
    def completed_requires_result(self) -> "RescueTransition":
        if self.to is RescueStatus.completed and not self.result:
            raise ValueError("进入已完成处理前必须填写处理结果")
        return self
