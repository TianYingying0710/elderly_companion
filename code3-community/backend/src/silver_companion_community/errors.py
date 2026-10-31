from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from silver_companion_shared.contracts.errors import CAPABILITY_NOT_IMPLEMENTED, to_validation_payload


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
