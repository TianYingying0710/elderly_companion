from typing import Protocol, Sequence

from silver_companion_community.schemas.courses import Course, CourseStatus
from silver_companion_community.schemas.knowledge import KnowledgeDoc, KnowledgeStatus
from silver_companion_community.schemas.rescue import RescueIncidentDetail, RescueStatus
from silver_companion_community.schemas.service import ServiceStatus, ServiceTask


class RescueIncidentRepository(Protocol):
    """紧急求助事件持久化边界。当前无任何实现。"""

    async def list_incidents(
        self, status: RescueStatus | None = None, limit: int = 20
    ) -> Sequence[RescueIncidentDetail]: ...

    async def get_incident(self, incident_id: str) -> RescueIncidentDetail | None: ...

    async def save_incident(self, incident: RescueIncidentDetail) -> None: ...


class ServiceTaskRepository(Protocol):
    """社区服务任务持久化边界。当前无任何实现。"""

    async def list_tasks(
        self, status: ServiceStatus | None = None, limit: int = 20
    ) -> Sequence[ServiceTask]: ...

    async def get_task(self, task_id: str) -> ServiceTask | None: ...

    async def save_task(self, task: ServiceTask) -> None: ...


class KnowledgeDocRepository(Protocol):
    """知识资料持久化边界。当前无任何实现。"""

    async def list_docs(
        self, status: KnowledgeStatus | None = None, limit: int = 20
    ) -> Sequence[KnowledgeDoc]: ...

    async def get_doc(self, doc_id: str) -> KnowledgeDoc | None: ...

    async def save_doc(self, doc: KnowledgeDoc) -> None: ...


class CourseRepository(Protocol):
    """课程持久化边界。当前无任何实现。"""

    async def list_courses(
        self,
        category: str | None = None,
        status: CourseStatus | None = None,
        limit: int = 20,
    ) -> Sequence[Course]: ...

    async def get_course(self, course_id: str) -> Course | None: ...

    async def save_course(self, course: Course) -> None: ...
