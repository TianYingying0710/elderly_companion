import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from silver_companion_community.api import api_router
from silver_companion_community.errors import (
    CapabilityNotImplementedError,
    capability_not_implemented_handler,
    validation_error_handler,
)
from silver_companion_shared.contracts.health import HealthPayload

load_dotenv()


def create_app() -> FastAPI:
    app = FastAPI(title="银龄伴社区端 API", version="0.1.0")
    origins = [item.strip() for item in os.getenv("CORS_ORIGINS", "http://127.0.0.1:5175").split(",") if item.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])
    app.add_exception_handler(CapabilityNotImplementedError, capability_not_implemented_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.include_router(api_router)

    @app.get("/health")
    def health() -> HealthPayload:
        return {"status": "ok", "service": "community-backend"}

    return app


app = create_app()
