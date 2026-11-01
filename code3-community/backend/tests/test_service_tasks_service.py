"""Service 业务规则：6 种状态转换、缺失任务、新建初始值、写前重读。

使用手写 fake repository，不接触数据库。
"""

import asyncio
from datetime import datetime, timezone
from typing import Sequence

import pytest

from silver_companion_community.schemas.service import (
    ServiceStatus,
    ServiceTask,
    ServiceTaskCreate,
)
from silver_companion_community.service_errors import (
    InvalidStateTransitionError,
    TaskNotFoundError,
)
from silver_companion_community.services.service_tasks import ServiceTaskService

AWARE = datetime(2026, 11, 1, 14, 0, tzinfo=timezone.utc)


class FakeServiceTaskRepository:
    """内存 fake，仅用于测试；不进入产品组合根。"""

    def __init__(self, tasks: Sequence[ServiceTask] = ()) -> None:
        self.tasks: dict[str, ServiceTask] = {task.id: task for task in tasks}
        self.reads = 0
        self.writes = 0
        self.transition_calls: list[tuple[str, ServiceStatus]] = []
        self.simulate_lost_update = False
        self.last_list_args: tuple[ServiceStatus | None, int] | None = None

    async def list_tasks(
        self, status: ServiceStatus | None = None, limit: int = 20
    ) -> Sequence[ServiceTask]:
        self.last_list_args = (status, limit)
        items = [task for task in self.tasks.values() if status is None or task.status is status]
        return items[:limit]

    async def get_task(self, task_id: str) -> ServiceTask | None:
        self.reads += 1
        return self.tasks.get(task_id)

    async def save_task(self, task: ServiceTask) -> None:
        self.writes += 1
        self.tasks[task.id] = task

    async def transition_task(self, task: ServiceTask, expected_status: ServiceStatus) -> bool:
        self.transition_calls.append((task.id, expected_status))
        current = self.tasks.get(task.id)
        if self.simulate_lost_update:
            # 模拟另一个请求在本次检查之后先完成了转换。
            if current is not None:
                self.tasks[task.id] = current.model_copy(
                    update={"status": ServiceStatus.in_service}
                )
            return False
        if current is None or current.status is not expected_status:
            return False
        self.tasks[task.id] = task
        return True


def _task(task_id: str, status: ServiceStatus) -> ServiceTask:
    return ServiceTask(
        id=task_id,
        title="代缴水电费",
        elder_name="示例老人 B",
        category="代办服务",
        scheduled_at=AWARE,
        location="XX 社区服务中心窗口",
        description="按老人委托到窗口代缴本月水电费",
        status=status,
        note="已协助填写申请表" if status is ServiceStatus.completed else None,
    )


def _service(*tasks: ServiceTask) -> tuple[ServiceTaskService, FakeServiceTaskRepository]:
    repository = FakeServiceTaskRepository(tasks)
    return ServiceTaskService(repository), repository


def test_pending_can_be_accepted() -> None:
    service, repository = _service(_task("t1", ServiceStatus.pending))

    accepted = asyncio.run(service.accept("t1"))

    assert accepted.status is ServiceStatus.in_service
    assert repository.tasks["t1"].status is ServiceStatus.in_service
    assert repository.transition_calls == [("t1", ServiceStatus.pending)]
    assert repository.writes == 0


def test_lost_update_is_reported_as_conflict_with_current_state() -> None:
    service, repository = _service(_task("t1", ServiceStatus.pending))
    repository.simulate_lost_update = True

    with pytest.raises(InvalidStateTransitionError) as error:
        asyncio.run(service.accept("t1"))

    assert error.value.current == "in_service"
    assert error.value.command == "accept"
    assert repository.transition_calls == [("t1", ServiceStatus.pending)]


def test_pending_cannot_be_completed() -> None:
    service, repository = _service(_task("t1", ServiceStatus.pending))

    with pytest.raises(InvalidStateTransitionError) as error:
        asyncio.run(service.complete("t1", "已协助办理"))

    assert error.value.current == "pending"
    assert error.value.command == "complete"
    assert repository.writes == 0


def test_in_service_cannot_be_accepted_again() -> None:
    service, repository = _service(_task("t1", ServiceStatus.in_service))

    with pytest.raises(InvalidStateTransitionError) as error:
        asyncio.run(service.accept("t1"))

    assert error.value.current == "in_service"
    assert error.value.command == "accept"
    assert repository.writes == 0


def test_in_service_completes_with_note() -> None:
    service, repository = _service(_task("t1", ServiceStatus.in_service))

    completed = asyncio.run(service.complete("t1", "  已代缴并回传凭证  "))

    assert completed.status is ServiceStatus.completed
    assert completed.note == "已代缴并回传凭证"
    assert repository.tasks["t1"].status is ServiceStatus.completed
    assert repository.transition_calls == [("t1", ServiceStatus.in_service)]
    assert repository.writes == 0


@pytest.mark.parametrize("status", [ServiceStatus.completed])
def test_completed_is_terminal_for_accept(status: ServiceStatus) -> None:
    service, _ = _service(_task("t1", status))

    with pytest.raises(InvalidStateTransitionError):
        asyncio.run(service.accept("t1"))


def test_completed_is_terminal_for_complete() -> None:
    service, _ = _service(_task("t1", ServiceStatus.completed))

    with pytest.raises(InvalidStateTransitionError):
        asyncio.run(service.complete("t1", "重复完成"))


def test_missing_task_raises_not_found() -> None:
    service, _ = _service()

    with pytest.raises(TaskNotFoundError):
        asyncio.run(service.get_task("missing"))
    with pytest.raises(TaskNotFoundError):
        asyncio.run(service.accept("missing"))
    with pytest.raises(TaskNotFoundError):
        asyncio.run(service.complete("missing", "已处理"))


def test_create_generates_id_and_pending_status() -> None:
    service, repository = _service()

    created = asyncio.run(
        service.create_task(
            ServiceTaskCreate(
                title="公益课程线下答疑",
                elder_name="示例老人 A",
                category="数字助老",
                scheduled_at=AWARE,
                location="XX 社区养老服务中心 2 楼教室",
                description="现场一对一指导",
            )
        )
    )

    assert created.status is ServiceStatus.pending
    assert created.note is None
    assert created.id and created.id == repository.tasks[created.id].id
    assert repository.tasks[created.id].title == "公益课程线下答疑"


def test_writes_reread_the_task_first() -> None:
    service, repository = _service(_task("t1", ServiceStatus.pending))

    asyncio.run(service.accept("t1"))

    assert repository.reads >= 1


def test_list_passes_filters_to_repository() -> None:
    tasks = (_task("t1", ServiceStatus.pending), _task("t2", ServiceStatus.completed))
    service, repository = _service(*tasks)

    listed = asyncio.run(service.list_tasks(ServiceStatus.completed, 5))

    assert [task.id for task in listed] == ["t2"]
    assert repository.last_list_args == (ServiceStatus.completed, 5)
