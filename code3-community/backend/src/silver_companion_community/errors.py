from fastapi import Request
from fastapi.responses import JSONResponse
from silver_companion_shared.contracts.errors import CAPABILITY_NOT_IMPLEMENTED


class CapabilityNotImplementedError(Exception):
    """The public contract exists, but no business implementation is connected."""


async def capability_not_implemented_handler(
    _request: Request, _error: CapabilityNotImplementedError
) -> JSONResponse:
    return JSONResponse(status_code=501, content=CAPABILITY_NOT_IMPLEMENTED)
