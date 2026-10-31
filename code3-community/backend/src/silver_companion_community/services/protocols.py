from typing import Protocol, Sequence

from silver_companion_community.schemas.courses import Course, CourseStatus, CourseStatusUpdate
from silver_companion_community.schemas.knowledge import (
    KnowledgeDoc,
    KnowledgeDocUpdate,
    KnowledgeStatus,
)
from silver_companion_community.schemas.rescue import (
    RescueIncidentDetail,
    RescueIncidentSummary,
    RescueStatus,
    RescueTransition,
)
from silver_companion_community.schemas.service import (
    ServiceStatus,
    ServiceTask,
    ServiceTransition,
)


class RescueIncidentService(Protocol):
    """紧急求助处置能力。实现需保证状态推进合法，非法跳态抛冲突。"""

    async def list_incidents(
        self, status: RescueStatus | None = None, limit: int = 20
    ) -> Sequence[RescueIncidentSummary]: ...

    async def get_incident(self, incident_id: str) -> RescueIncidentDetail | None: ...

    async def transition(
        self, incident_id: str, transition: RescueTransition
    ) -> RescueIncidentDetail: ...


class ServiceTaskService(Protocol):
    """社区服务协同能力。完成服务时写入服务记录。"""

    async def list_tasks(
        self, status: ServiceStatus | None = None, limit: int = 20
    ) -> Sequence[ServiceTask]: ...

    async def get_task(self, task_id: str) -> ServiceTask | None: ...

    async def transition(self, task_id: str, transition: ServiceTransition) -> ServiceTask: ...


class KnowledgeDocService(Protocol):
    """知识资料审核与启停。"""

    async def list_docs(
        self, status: KnowledgeStatus | None = None, limit: int = 20
    ) -> Sequence[KnowledgeDoc]: ...

    async def get_doc(self, doc_id: str) -> KnowledgeDoc | None: ...

    async def update_doc(self, doc_id: str, update: KnowledgeDocUpdate) -> KnowledgeDoc: ...


class CourseService(Protocol):
    """助老课程发布与下架。"""

    async def list_courses(
        self,
        category: str | None = None,
        status: CourseStatus | None = None,
        limit: int = 20,
    ) -> Sequence[Course]: ...

    async def get_course(self, course_id: str) -> Course | None: ...

    async def update_status(self, course_id: str, update: CourseStatusUpdate) -> Course: ...
