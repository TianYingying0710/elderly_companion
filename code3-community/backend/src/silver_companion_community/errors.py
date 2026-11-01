from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from silver_companion_shared.contracts.errors import CAPABILITY_NOT_IMPLEMENTED, to_validation_payload

from silver_companion_community.service_errors import (
    InvalidStateTransitionError,
    ServiceUnavailableError,
    TaskNotFoundError,
)


class CapabilityNotImplementedError(Exception):
    """The public contract exists, but no business implementation is connected."""


async def capability_not_implemented_handler(
    _request: Request, _error: CapabilityNotImplementedError
) -> JSONResponse:
    return JSONResponse(status_code=501, content=CAPABILITY_NOT_IMPLEMENTED)


async def validation_error_handler(
    _request: Request, error: RequestValidationError
) -> JSONResponse:
    return JSONResponse(status_code=422, content=to_validation_payload(error))


async def task_not_found_handler(_request: Request, _error: TaskNotFoundError) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content={"error": {"code": "task_not_found", "message": "服务任务不存在"}},
    )


async def invalid_state_transition_handler(
    _request: Request, _error: InvalidStateTransitionError
) -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content={
            "error": {
                "code": "invalid_state_transition",
                "message": "该任务当前状态不允许此操作",
            }
        },
    )


async def service_unavailable_handler(
    _request: Request, _error: ServiceUnavailableError
) -> JSONResponse:
    # 存储不可用：不回传路径、SQL 或驱动信息。
    return JSONResponse(
        status_code=503,
        content={"error": {"code": "service_unavailable", "message": "服务暂时不可用"}},
    )


async def internal_error_handler(_request: Request, _error: Exception) -> JSONResponse:
    # 未预期异常：只给稳定 code，不泄露堆栈、SQL 或文件路径。
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "internal_error", "message": "服务内部错误"}},
    )
