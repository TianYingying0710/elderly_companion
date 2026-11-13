import os
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from silver_companion_elder.errors import SosStorageUnavailableError
from silver_companion_elder.repositories.protocols import SosEventRepository
from silver_companion_elder.schemas.sos_events import (
    SosEvent,
    SosEventCreate,
    SosEventStatus,
)

SOS_DATABASE_PATH_ENV = "SOS_DATABASE_PATH"

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

    async def update_status(
        self,
        event_id: str,
        status: SosEventStatus,
        expected_status: SosEventStatus,
        note: str | None = None,
    ) -> SosEvent | None:
        """条件更新：仅当当前状态仍等于 expected_status 时前进，否则返回 None。note 非 None 时一并覆盖备注。"""
        event = self._events.get(event_id)
        if event is None or event.status != expected_status:
            return None
        updates: dict[str, object] = {"status": status}
        if note is not None:
            updates["note"] = note
        updated = event.model_copy(update=updates)
        self._events[event_id] = updated
        return updated


@lru_cache
def get_sos_event_repository() -> SosEventRepository:
    """FastAPI 依赖：单例仓库。

    设置 SOS_DATABASE_PATH 时使用 SQLite 持久化（2026-11-14 用户授权例外，
    模式与 code3 服务任务一致）；未设置时保持进程内存存储，重启即清。
    """
    raw = os.getenv(SOS_DATABASE_PATH_ENV, "").strip()
    if raw:
        from silver_companion_elder.repositories.sqlite_sos_events import (
            SqliteSosEventRepository,
        )

        path = Path(raw)
        try:
            # 只创建已配置数据库文件的父目录，失败按 503 处理。
            path.parent.mkdir(parents=True, exist_ok=True)
        except OSError as error:
            raise SosStorageUnavailableError("sos database directory is not usable") from error
        repository = SqliteSosEventRepository(path)
        repository.initialize()
        return repository
    return InMemorySosEventRepository()
