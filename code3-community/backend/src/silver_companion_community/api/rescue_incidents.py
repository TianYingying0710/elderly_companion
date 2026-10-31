from fastapi import APIRouter

from silver_companion_community.dependencies.capabilities import capability_not_implemented
from silver_companion_community.schemas.rescue import (
    RescueIncidentDetail,
    RescueIncidentSummary,
    RescueStatus,
    RescueTransition,
)

from .params import PageLimit, ResourceId

router = APIRouter(prefix="/rescue-incidents", tags=["rescue-incidents"])

NOT_IMPLEMENTED = {501: {"description": "该业务能力尚未接入"}}
NOT_FOUND = {404: {"description": "事件不存在"}}
CONFLICT = {409: {"description": "不允许的状态推进"}}


@router.get("", response_model=list[RescueIncidentSummary], responses=NOT_IMPLEMENTED)
async def list_rescue_incidents(
    status: RescueStatus | None = None, limit: PageLimit = 20
) -> list[RescueIncidentSummary]:
    """按状态过滤的紧急求助列表。"""
    capability_not_implemented()


@router.get(
    "/{incident_id}",
    response_model=RescueIncidentDetail,
    responses={**NOT_IMPLEMENTED, **NOT_FOUND},
)
async def get_rescue_incident(incident_id: ResourceId) -> RescueIncidentDetail:
    """详情包含家庭协同进度与 4 步时间轴。"""
    capability_not_implemented()


@router.post(
    "/{incident_id}/transitions",
    response_model=RescueIncidentDetail,
    responses={**NOT_IMPLEMENTED, **NOT_FOUND, **CONFLICT},
)
async def transition_rescue_incident(
    incident_id: ResourceId, transition: RescueTransition
) -> RescueIncidentDetail:
    """推进一态；`completed` 必须带处理结果，非法跳态由实现阶段判 409。"""
    capability_not_implemented()
