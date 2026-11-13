"""SOS 事件 SQLite 持久化实现（2026-11-14 用户授权的单表例外，模式与 code3 服务任务一致）。

只负责建表（IF NOT EXISTS）、读写与行映射；状态机前进判断留在 API 层，
并发安全靠 `BEGIN IMMEDIATE` + 条件更新（只允许从 expected_status 前进一步）。
所有 `sqlite3.Error` 统一翻译为 `SosStorageUnavailableError`（HTTP 503）。
"""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from silver_companion_elder.errors import SosStorageUnavailableError
from silver_companion_elder.schemas.sos_events import (
    SosEvent,
    SosEventCreate,
    SosEventStatus,
)

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS sos_events (
    id TEXT PRIMARY KEY NOT NULL,
    elder_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'resolved')),
    note TEXT
)
"""

CONDITIONAL_UPDATE_SQL = """
UPDATE sos_events
SET status = ?
WHERE id = ? AND status = ?
"""


class SqliteSosEventRepository:
    def __init__(self, database_path: str | Path) -> None:
        self._database_path = str(database_path)

    def initialize(self) -> None:
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(CREATE_TABLE_SQL)
            connection.commit()
        except sqlite3.Error as error:
            connection.rollback()
            raise SosStorageUnavailableError("failed to initialize sos_events table") from error
        finally:
            connection.close()

    async def create(self, payload: SosEventCreate) -> SosEvent:
        event = SosEvent(
            id=uuid4().hex,
            elder_id=payload.elder_id,
            created_at=datetime.now(timezone.utc).isoformat(),
            status="pending",
            note=payload.note,
        )
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(
                "INSERT INTO sos_events (id, elder_id, created_at, status, note) VALUES (?, ?, ?, ?, ?)",
                (event.id, event.elder_id, event.created_at, event.status, event.note),
            )
            connection.commit()
        except sqlite3.Error as error:
            connection.rollback()
            raise SosStorageUnavailableError("failed to save sos event") from error
        finally:
            connection.close()
        return event

    async def list(self, elder_id: str | None = None) -> list[SosEvent]:
        sql = "SELECT * FROM sos_events"
        params: list[object] = []
        if elder_id is not None:
            sql += " WHERE elder_id = ?"
            params.append(elder_id)
        sql += " ORDER BY created_at DESC, rowid DESC"

        connection = self._connect()
        try:
            rows = connection.execute(sql, params).fetchall()
        except sqlite3.Error as error:
            raise SosStorageUnavailableError("failed to list sos events") from error
        finally:
            connection.close()
        return [self._row_to_event(row) for row in rows]

    async def get(self, event_id: str) -> SosEvent | None:
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT * FROM sos_events WHERE id = ?", (event_id,)
            ).fetchone()
        except sqlite3.Error as error:
            raise SosStorageUnavailableError("failed to read sos event") from error
        finally:
            connection.close()
        return None if row is None else self._row_to_event(row)

    async def update_status(
        self, event_id: str, status: SosEventStatus, expected_status: SosEventStatus
    ) -> SosEvent | None:
        """条件写入：库中状态仍等于 expected_status 才前进一步，返回更新后事件；未命中返回 None。"""
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            cursor = connection.execute(
                CONDITIONAL_UPDATE_SQL, (status, event_id, expected_status)
            )
            updated: SosEvent | None = None
            if cursor.rowcount == 1:
                row = connection.execute(
                    "SELECT * FROM sos_events WHERE id = ?", (event_id,)
                ).fetchone()
                updated = None if row is None else self._row_to_event(row)
            connection.commit()
            return updated
        except sqlite3.Error as error:
            connection.rollback()
            raise SosStorageUnavailableError("failed to update sos event status") from error
        finally:
            connection.close()

    def _connect(self) -> sqlite3.Connection:
        try:
            connection = sqlite3.connect(self._database_path)
        except sqlite3.Error as error:
            raise SosStorageUnavailableError("sos event storage is unavailable") from error
        connection.row_factory = sqlite3.Row
        return connection

    @staticmethod
    def _row_to_event(row: sqlite3.Row) -> SosEvent:
        return SosEvent(
            id=row["id"],
            elder_id=row["elder_id"],
            created_at=row["created_at"],
            status=row["status"],
            note=row["note"],
        )
