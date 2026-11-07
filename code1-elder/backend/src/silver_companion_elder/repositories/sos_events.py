from datetime import datetime, timezone
from functools import lru_cache
from uuid import uuid4

from silver_companion_elder.schemas.sos_events import (
    SosEvent,
    SosEventCreate,
    SosEventStatus,
)

# 状态流转只允许沿 pending → processing → resolved 前进
STATUS_ORDER: dict[str, int] = {"pending": 0, "processing": 1, "resolved": 2}


class InMemorySosEventRepository:
    """SOS 事件进程内存储。

    注意：服务重启后全部事件丢失（当前演示阶段的预期行为，
    待真实数据阶段再替换为持久化实现，接口不变）。
    """

    def __init__(self) -> None:
        self._events: dict[str, SosEvent] = {}

    async def create(self, payload: SosEventCreate) -> SosEvent:
        event = SosEvent(
            id=uuid4().hex,
            elder_id=payload.elder_id,
            created_at=datetime.now(timezone.utc).isoformat(),
            status="pending",
            note=payload.note,
        )
        self._events[event.id] = event
        return event

    async def list(self, elder_id: str | None = None) -> list[SosEvent]:
        events = list(self._events.values())
        if elder_id is not None:
            events = [event for event in events if event.elder_id == elder_id]
        return sorted(events, key=lambda event: event.created_at, reverse=True)

    async def get(self, event_id: str) -> SosEvent | None:
        return self._events.get(event_id)

    async def update_status(self, event_id: str, status: SosEventStatus) -> SosEvent | None:
        event = self._events.get(event_id)
        if event is None:
            return None
        updated = event.model_copy(update={"status": status})
        self._events[event_id] = updated
        return updated


@lru_cache
def get_sos_event_repository() -> InMemorySosEventRepository:
    """FastAPI 依赖：进程内单例仓库。"""
    return InMemorySosEventRepository()
