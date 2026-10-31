from fastapi import APIRouter

from silver_companion_community.dependencies.capabilities import capability_not_implemented
from silver_companion_community.schemas.knowledge import (
    KnowledgeDoc,
    KnowledgeDocUpdate,
    KnowledgeStatus,
)

from .params import PageLimit, ResourceId

router = APIRouter(prefix="/knowledge-docs", tags=["knowledge-docs"])

NOT_IMPLEMENTED = {501: {"description": "该业务能力尚未接入"}}


@router.get("", response_model=list[KnowledgeDoc], responses=NOT_IMPLEMENTED)
async def list_knowledge_docs(
    status: KnowledgeStatus | None = None, limit: PageLimit = 20
) -> list[KnowledgeDoc]:
    """知识资料列表，可按状态过滤。"""
    capability_not_implemented()


@router.get(
    "/{doc_id}",
    response_model=KnowledgeDoc,
    responses=NOT_IMPLEMENTED,
)
async def get_knowledge_doc(doc_id: ResourceId) -> KnowledgeDoc:
    """单份知识资料详情。"""
    capability_not_implemented()


@router.patch(
    "/{doc_id}",
    response_model=KnowledgeDoc,
    responses=NOT_IMPLEMENTED,
)
async def update_knowledge_doc(doc_id: ResourceId, update: KnowledgeDocUpdate) -> KnowledgeDoc:
    """审核内容或启停；`content` 与 `status` 至少给一个。"""
    capability_not_implemented()
