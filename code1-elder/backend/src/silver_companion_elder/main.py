import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from silver_companion_shared.contracts.health import HealthPayload
from silver_companion_elder.api import api_router
from silver_companion_elder.errors import (
    CapabilityNotImplementedError,
    CourseNotFoundError,
    IllegalSosStatusTransitionError,
    SosEventNotFoundError,
    VideoNotFoundError,
    capability_not_implemented_handler,
    course_not_found_handler,
    illegal_sos_status_transition_handler,
    sos_event_not_found_handler,
    validation_error_handler,
    video_not_found_handler,
)

load_dotenv()


def create_app() -> FastAPI:
    app = FastAPI(title="银龄伴老人端 API", version="0.1.0")
    default_origins = "http://127.0.0.1:5173,https://localhost"
    origins = [item.strip() for item in os.getenv("CORS_ORIGINS", default_origins).split(",") if item.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])
    app.add_exception_handler(CapabilityNotImplementedError, capability_not_implemented_handler)
    app.add_exception_handler(SosEventNotFoundError, sos_event_not_found_handler)
    app.add_exception_handler(IllegalSosStatusTransitionError, illegal_sos_status_transition_handler)
    app.add_exception_handler(CourseNotFoundError, course_not_found_handler)
    app.add_exception_handler(VideoNotFoundError, video_not_found_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.include_router(api_router)

    @app.get("/health")
    def health() -> HealthPayload:
        return {"status": "ok", "service": "elder-backend"}

    return app


app = create_app()
