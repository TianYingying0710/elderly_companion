from fastapi import APIRouter

from silver_companion_community.dependencies.capabilities import capability_not_implemented
from silver_companion_community.schemas.service import ServiceStatus, ServiceTask, ServiceTransition

from .params import PageLimit, ResourceId

router = APIRouter(prefix="/service-tasks", tags=["service-tasks"])

NOT_IMPLEMENTED = {501: {"description": "该业务能力尚未接入"}}


@router.get("", response_model=list[ServiceTask], responses=NOT_IMPLEMENTED)
async def list_service_tasks(
    status: ServiceStatus | None = None, limit: PageLimit = 20
) -> list[ServiceTask]:
    """按状态过滤的社区服务任务列表。"""
    capability_not_implemented()


@router.get(
    "/{task_id}",
    response_model=ServiceTask,
    responses=NOT_IMPLEMENTED,
)
async def get_service_task(task_id: ResourceId) -> ServiceTask:
    """单个服务任务详情。"""
    capability_not_implemented()


@router.post(
    "/{task_id}/transitions",
    response_model=ServiceTask,
    responses=NOT_IMPLEMENTED,
)
async def transition_service_task(
    task_id: ResourceId, transition: ServiceTransition
) -> ServiceTask:
    """推进一态；完成时必须留下服务记录。"""
    capability_not_implemented()
