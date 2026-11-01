"""SQLite 实现：只负责建表（IF NOT EXISTS）、读写与行映射。

不含状态机判断；所有 `sqlite3.Error` 统一翻译为 `ServiceUnavailableError`。
"""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

from silver_companion_community.schemas.service import ServiceStatus, ServiceTask
from silver_companion_community.service_errors import ServiceUnavailableError

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS service_tasks (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    elder_name TEXT NOT NULL,
    category TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_service', 'completed')),
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)
"""

TRANSITION_SQL = """
UPDATE service_tasks
SET status = ?, note = ?, updated_at = ?
WHERE id = ? AND status = ?
"""

UPSERT_SQL = """
INSERT INTO service_tasks (
    id, title, elder_name, category, scheduled_at,
    location, description, status, note, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    elder_name = excluded.elder_name,
    category = excluded.category,
    scheduled_at = excluded.scheduled_at,
    location = excluded.location,
    description = excluded.description,
    status = excluded.status,
    note = excluded.note,
    updated_at = excluded.updated_at
"""


class SqliteServiceTaskRepository:
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
            raise ServiceUnavailableError("failed to initialize service_tasks table") from error
        finally:
            connection.close()

    async def list_tasks(
        self, status: ServiceStatus | None = None, limit: int = 20
    ) -> Sequence[ServiceTask]:
        sql = "SELECT * FROM service_tasks"
        params: list[object] = []
        if status is not None:
            sql += " WHERE status = ?"
            params.append(status.value)
        sql += " ORDER BY rowid LIMIT ?"
        params.append(limit)

        connection = self._connect()
        try:
            rows = connection.execute(sql, params).fetchall()
        except sqlite3.Error as error:
            raise ServiceUnavailableError("failed to list service tasks") from error
        finally:
            connection.close()
        return [self._row_to_task(row) for row in rows]

    async def get_task(self, task_id: str) -> ServiceTask | None:
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT * FROM service_tasks WHERE id = ?", (task_id,)
            ).fetchone()
        except sqlite3.Error as error:
            raise ServiceUnavailableError("failed to read service task") from error
        finally:
            connection.close()
        return None if row is None else self._row_to_task(row)

    async def save_task(self, task: ServiceTask) -> None:
        now = datetime.now(timezone.utc).isoformat()
        params = (
            task.id,
            task.title,
            task.elder_name,
            task.category,
            task.scheduled_at.isoformat(),
            task.location,
            task.description,
            task.status.value,
            task.note,
            now,
            now,
        )
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(UPSERT_SQL, params)
            connection.commit()
        except sqlite3.Error as error:
            connection.rollback()
            raise ServiceUnavailableError("failed to save service task") from error
        finally:
            connection.close()

    async def transition_task(self, task: ServiceTask, expected_status: ServiceStatus) -> bool:
        """条件写入：只有库中状态仍等于 expected_status 时才更新，返回是否命中一行。"""
        now = datetime.now(timezone.utc).isoformat()
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            cursor = connection.execute(
                TRANSITION_SQL,
                (task.status.value, task.note, now, task.id, expected_status.value),
            )
            updated = cursor.rowcount == 1
            connection.commit()
            return updated
        except sqlite3.Error as error:
            connection.rollback()
            raise ServiceUnavailableError("failed to transition service task") from error
        finally:
            connection.close()

    def _connect(self) -> sqlite3.Connection:
        try:
            connection = sqlite3.connect(self._database_path)
        except sqlite3.Error as error:
            raise ServiceUnavailableError("service task storage is unavailable") from error
        connection.row_factory = sqlite3.Row
        return connection

    @staticmethod
    def _row_to_task(row: sqlite3.Row) -> ServiceTask:
        return ServiceTask(
            id=row["id"],
            title=row["title"],
            elder_name=row["elder_name"],
            category=row["category"],
            scheduled_at=row["scheduled_at"],
            location=row["location"],
            description=row["description"],
            status=row["status"],
            note=row["note"],
        )
