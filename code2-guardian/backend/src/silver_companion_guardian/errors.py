from fastapi import Request
from fastapi.responses import JSONResponse

from .service_errors import HealthDataSourceUnavailableError


async def health_data_source_unavailable_handler(
    _request: Request, _exc: HealthDataSourceUnavailableError
) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "error": {
                "code": "health_data_source_unavailable",
                "message": "健康数据源尚未接入",
                "fields": [],
            }
        },
    )
