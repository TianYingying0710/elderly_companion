from fastapi import APIRouter

from .courses import router as courses_router
from .knowledge_docs import router as knowledge_docs_router
from .rescue_incidents import router as rescue_incidents_router
from .service_tasks import router as service_tasks_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(rescue_incidents_router)
api_router.include_router(service_tasks_router)
api_router.include_router(knowledge_docs_router)
api_router.include_router(courses_router)
