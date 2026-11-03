import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from silver_companion_shared.contracts.health import HealthPayload

from .api.health_data import health_overview
from .schemas.health_data import HealthOverviewDto
from .errors import health_data_source_unavailable_handler
from .service_errors import HealthDataSourceUnavailableError

load_dotenv()


def create_app() -> FastAPI:
    app = FastAPI(title="银龄伴监护人端 API", version="0.1.0")
    origins = [item.strip() for item in os.getenv("CORS_ORIGINS", "http://127.0.0.1:5174").split(",") if item.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])
    app.add_exception_handler(HealthDataSourceUnavailableError, health_data_source_unavailable_handler)
    # Register directly to avoid the lazy router wrapper in the pinned FastAPI runtime.
    app.add_api_route(
        "/api/v1/health-overview/{elder_id}",
        health_overview,
        methods=["GET"],
        response_model=HealthOverviewDto,
    )

    @app.get("/health")
    def health() -> HealthPayload:
        return {"status": "ok", "service": "guardian-backend"}

    return app


app = create_app()
