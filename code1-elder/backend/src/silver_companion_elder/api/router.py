from fastapi import APIRouter

from .courses import router as courses_router
from .learning_records import router as learning_records_router
from .sos_events import router as sos_events_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(courses_router)
api_router.include_router(learning_records_router)
api_router.include_router(sos_events_router)
