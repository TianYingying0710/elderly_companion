from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from silver_companion_elder.errors import (
    IllegalSosStatusTransitionError,
    SosEventNotFoundError,
)
from silver_companion_elder.repositories.protocols import SosEventRepository
from silver_companion_elder.repositories.sos_events import (
    STATUS_ORDER,
    get_sos_event_repository,
)
from silver_companion_elder.schemas.sos_events import (
    ElderId,
    SosEvent,
    SosEventCreate,
    SosEventStatusUpdate,
)

router = APIRouter(prefix="/sos-events", tags=["sos-events"])

EventId = Annotated[str, Path(min_length=1, pattern=r".*\S.*")]
ElderIdQuery = Annotated[ElderId, Query()]
error_responses = {
    404: {"description": "求助事件不存在"},
    409: {"description": "状态不允许回退或重复流转"},
}


@router.post("", response_model=SosEvent, status_code=201)
async def create_sos_event(
    payload: SosEventCreate,
    repository: Annotated[SosEventRepository, Depends(get_sos_event_repository)],
) -> SosEvent:
    return await repository.create(payload)


@router.get("", response_model=list[SosEvent])
async def list_sos_events(
    repository: Annotated[SosEventRepository, Depends(get_sos_event_repository)],
    elder_id: ElderIdQuery | None = None,
) -> list[SosEvent]:
    return await repository.list(elder_id)


@router.patch("/{event_id}", response_model=SosEvent, responses=error_responses)
async def update_sos_event_status(
    event_id: EventId,
    payload: SosEventStatusUpdate,
    repository: Annotated[SosEventRepository, Depends(get_sos_event_repository)],
) -> SosEvent:
    event = await repository.get(event_id)
    if event is None:
        raise SosEventNotFoundError
    if STATUS_ORDER[payload.status] <= STATUS_ORDER[event.status]:
        raise IllegalSosStatusTransitionError
    # 条件更新：并发下状态已被其他请求改变时未命中，按不允许流转处理（409）。
    updated = await repository.update_status(
        event_id, payload.status, expected_status=event.status, note=payload.note
    )
    if updated is None:
        raise IllegalSosStatusTransitionError
    return updated


# POST 别名：微信小程序 uni.request 不支持 PATCH 方法（与 code3 服务任务
# 采用 POST transitions 同一平台约束），语义与 PATCH 完全一致。
@router.post(
    "/{event_id}/transitions", response_model=SosEvent, responses=error_responses
)
async def transition_sos_event_status(
    event_id: EventId,
    payload: SosEventStatusUpdate,
    repository: Annotated[SosEventRepository, Depends(get_sos_event_repository)],
) -> SosEvent:
    return await update_sos_event_status(event_id, payload, repository)
