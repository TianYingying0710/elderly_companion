from enum import Enum
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

NonEmptyText = Annotated[str, Field(min_length=1)]


class KnowledgeStatus(str, Enum):
    """知识资料状态：待确认 → 已启用 ↔ 已停用。"""

    pending_review = "pending_review"
    enabled = "enabled"
    disabled = "disabled"


class KnowledgeDoc(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: NonEmptyText
    name: NonEmptyText
    content: str
    status: KnowledgeStatus
    updated_at: AwareDatetime


class KnowledgeDocUpdate(BaseModel):
    """审核内容或启停；两个字段至少给一个。"""

    model_config = ConfigDict(str_strip_whitespace=True)

    content: Annotated[str, Field(min_length=1)] | None = None
    status: KnowledgeStatus | None = None

    @model_validator(mode="after")
    def requires_at_least_one_field(self) -> "KnowledgeDocUpdate":
        if self.content is None and self.status is None:
            raise ValueError("至少需要提供 content 或 status")
        return self
