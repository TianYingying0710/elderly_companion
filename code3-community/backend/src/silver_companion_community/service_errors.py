"""业务异常。不导入 FastAPI，供 service / repository 层使用。

HTTP 映射统一在 `errors.py` 的处理器中完成，因此本模块保持零框架依赖。
"""


class TaskNotFoundError(Exception):
    """请求的服务任务不存在。"""

    def __init__(self, task_id: str) -> None:
        super().__init__(f"service task not found: {task_id}")
        self.task_id = task_id


class InvalidStateTransitionError(Exception):
    """当前状态不允许该命令。"""

    def __init__(self, task_id: str, current: str, command: str) -> None:
        super().__init__(f"invalid transition: {current} -/-> {command} ({task_id})")
        self.task_id = task_id
        self.current = current
        self.command = command


class ServiceUnavailableError(Exception):
    """存储层不可用。异常信息只用于日志，不返回给客户端。"""
