import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from silver_companion_shared.contracts.health import HealthPayload
from silver_companion_elder.api import api_router
from silver_companion_elder.errors import (
    CapabilityNotImplementedError,
    capability_not_implemented_handler,
)


def create_app() -> FastAPI:
    app = FastAPI(title="银龄伴老人端 API", version="0.1.0")
    default_origins = "http://127.0.0.1:5173,https://localhost"
    origins = [item.strip() for item in os.getenv("CORS_ORIGINS", default_origins).split(",") if item.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])
    app.add_exception_handler(CapabilityNotImplementedError, capability_not_implemented_handler)
    app.include_router(api_router)

    @app.get("/health")
    def health() -> HealthPayload:
        return {"status": "ok", "service": "elder-backend"}

    return app


app = create_app()
