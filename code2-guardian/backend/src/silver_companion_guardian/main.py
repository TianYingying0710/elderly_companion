import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from silver_companion_shared.contracts.health import HealthPayload

load_dotenv()


def create_app() -> FastAPI:
    app = FastAPI(title="银龄伴监护人端 API", version="0.1.0")
    origins = [item.strip() for item in os.getenv("CORS_ORIGINS", "http://127.0.0.1:5174").split(",") if item.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])

    @app.get("/health")
    def health() -> HealthPayload:
        return {"status": "ok", "service": "guardian-backend"}

    return app


app = create_app()
