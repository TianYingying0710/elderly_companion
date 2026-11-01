"""社区服务任务业务层：状态机与「完成必须带服务记录」的唯一真源。

不导入 FastAPI、sqlite3 或任何具体 Repository，只依赖 Repository Protocol。
"""

from typing import Sequence
from uuid import uuid4

from silver_companion_community.repositories.protocols import ServiceTaskRepository
from silver_companion_community.schemas.service import (
    ServiceStatus,
    ServiceTask,
    ServiceTaskCreate,
)
from silver_companion_community.service_errors import (
    InvalidStateTransitionError,
    TaskNotFoundError,
)


class ServiceTaskService:
    def __init__(self, repository: ServiceTaskRepository) -> None:
        self._repository = repository

    async def list_tasks(
        self, status: ServiceStatus | None = None, limit: int = 20
    ) -> Sequence[ServiceTask]:
        return await self._repository.list_tasks(status, limit)

    async def get_task(self, task_id: str) -> ServiceTask:
        task = await self._repository.get_task(task_id)
        if task is None:
            raise TaskNotFoundError(task_id)
        return task

    async def create_task(self, payload: ServiceTaskCreate) -> ServiceTask:
        # id / status / note 只能由服务端决定，因此不从 payload 读取。
        task = ServiceTask(
            id=str(uuid4()),
            title=payload.title,
            elder_name=payload.elder_name,
            category=payload.category,
            scheduled_at=payload.scheduled_at,
            location=payload.location,
            description=payload.description,
            status=ServiceStatus.pending,
            note=None,
        )
        await self._repository.save_task(task)
        return task

    async def accept(self, task_id: str) -> ServiceTask:
        # 写前重新读取服务端真值，输入参数不参与判断。
        task = await self.get_task(task_id)
        if task.status is not ServiceStatus.pending:
            raise InvalidStateTransitionError(task_id, task.status.value, "accept")
        accepted = task.model_copy(update={"status": ServiceStatus.in_service})
        # 条件更新保证并发下只有一个请求成功；失败说明状态已被他人推进。
        if not await self._repository.transition_task(accepted, ServiceStatus.pending):
            current = await self.get_task(task_id)
            raise InvalidStateTransitionError(task_id, current.status.value, "accept")
        return accepted

    async def complete(self, task_id: str, note: str) -> ServiceTask:
        task = await self.get_task(task_id)
        if task.status is not ServiceStatus.in_service:
            raise InvalidStateTransitionError(task_id, task.status.value, "complete")
        completed = task.model_copy(
            update={"status": ServiceStatus.completed, "note": note.strip()}
        )
        if not await self._repository.transition_task(completed, ServiceStatus.in_service):
            current = await self.get_task(task_id)
            raise InvalidStateTransitionError(task_id, current.status.value, "complete")
        return completed
