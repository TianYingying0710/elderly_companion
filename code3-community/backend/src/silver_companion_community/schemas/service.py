from enum import Enum
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

# 无上限的非空文本：仅用于服务端生成的 id。
NonEmptyText = Annotated[str, Field(min_length=1)]
# 短标签：标题、老人称呼、服务类别。
LabelText = Annotated[str, Field(min_length=1, max_length=100)]
# 地点。
LocationText = Annotated[str, Field(min_length=1, max_length=200)]
# 长文本：需求描述、服务记录。
LongText = Annotated[str, Field(min_length=1, max_length=2000)]


class ServiceStatus(str, Enum):
    """社区服务 3 态。"""

    pending = "pending"
    in_service = "in_service"
    completed = "completed"


class ServiceTask(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: NonEmptyText
    title: LabelText
    elder_name: LabelText
    category: LabelText
    scheduled_at: AwareDatetime
    location: LocationText
    description: LongText
    status: ServiceStatus
    # 服务记录：推进到 completed 时写入
    note: LongText | None = None


class ServiceTaskCreate(BaseModel):
    """新建服务任务。`id` / `status` / `note` 由服务端生成，客户端不得提交。"""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: LabelText
    elder_name: LabelText
    category: LabelText
    scheduled_at: AwareDatetime
    location: LocationText
    description: LongText


class ServiceTaskComplete(BaseModel):
    """完成服务任务。必须留下非空服务记录。"""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    note: LongText
