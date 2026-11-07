from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from silver_companion_elder.errors import (
    IllegalSosStatusTransitionError,
    SosEventNotFoundError,
)
from silver_companion_elder.repositories.sos_events import (
    STATUS_ORDER,
    InMemorySosEventRepository,
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
    repository: Annotated[InMemorySosEventRepository, Depends(get_sos_event_repository)],
) -> SosEvent:
    return await repository.create(payload)


@router.get("", response_model=list[SosEvent])
async def list_sos_events(
    repository: Annotated[InMemorySosEventRepository, Depends(get_sos_event_repository)],
    elder_id: ElderIdQuery | None = None,
) -> list[SosEvent]:
    return await repository.list(elder_id)


@router.patch("/{event_id}", response_model=SosEvent, responses=error_responses)
async def update_sos_event_status(
    event_id: EventId,
    payload: SosEventStatusUpdate,
    repository: Annotated[InMemorySosEventRepository, Depends(get_sos_event_repository)],
) -> SosEvent:
    event = await repository.get(event_id)
    if event is None:
        raise SosEventNotFoundError
    if STATUS_ORDER[payload.status] <= STATUS_ORDER[event.status]:
        raise IllegalSosStatusTransitionError
    updated = await repository.update_status(event_id, payload.status)
    assert updated is not None  # 上一步已确认事件存在
    return updated
