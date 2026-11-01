from typing import Annotated

from fastapi import APIRouter, Depends, status

from silver_companion_community.dependencies.database import get_service_task_service
from silver_companion_community.schemas.service import (
    ServiceStatus,
    ServiceTask,
    ServiceTaskComplete,
    ServiceTaskCreate,
)
from silver_companion_community.services.service_tasks import ServiceTaskService

from .params import PageLimit, ResourceId

router = APIRouter(prefix="/service-tasks", tags=["service-tasks"])

ERROR_RESPONSES = {
    404: {"description": "服务任务不存在"},
    409: {"description": "当前状态不允许该操作"},
    422: {"description": "请求参数不合法"},
    503: {"description": "存储不可用"},
}

ServiceTaskServiceDep = Annotated[ServiceTaskService, Depends(get_service_task_service)]


@router.post(
    "",
    response_model=ServiceTask,
    status_code=status.HTTP_201_CREATED,
    responses=ERROR_RESPONSES,
)
async def create_service_task(
    payload: ServiceTaskCreate, service: ServiceTaskServiceDep
) -> ServiceTask:
    """新建服务任务；`id`、`status`、`note` 由服务端生成。"""
    return await service.create_task(payload)


@router.get("", response_model=list[ServiceTask], responses=ERROR_RESPONSES)
async def list_service_tasks(
    service: ServiceTaskServiceDep,
    status: ServiceStatus | None = None,
    limit: PageLimit = 20,
) -> list[ServiceTask]:
    """按状态过滤的社区服务任务列表；空库返回 200 与空数组。"""
    return list(await service.list_tasks(status, limit))


@router.get("/{task_id}", response_model=ServiceTask, responses=ERROR_RESPONSES)
async def get_service_task(task_id: ResourceId, service: ServiceTaskServiceDep) -> ServiceTask:
    """单个服务任务详情。"""
    return await service.get_task(task_id)


@router.post("/{task_id}/accept", response_model=ServiceTask, responses=ERROR_RESPONSES)
async def accept_service_task(task_id: ResourceId, service: ServiceTaskServiceDep) -> ServiceTask:
    """接收任务：pending → in_service；其他状态返回 409。"""
    return await service.accept(task_id)


@router.post("/{task_id}/complete", response_model=ServiceTask, responses=ERROR_RESPONSES)
async def complete_service_task(
    task_id: ResourceId, payload: ServiceTaskComplete, service: ServiceTaskServiceDep
) -> ServiceTask:
    """完成任务：in_service → completed，必须带非空服务记录。"""
    return await service.complete(task_id, payload.note)
