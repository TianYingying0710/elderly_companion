from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from silver_companion_shared.contracts.errors import (
    CAPABILITY_NOT_IMPLEMENTED,
    ErrorPayload,
    to_validation_payload,
)


class CapabilityNotImplementedError(Exception):
    """The public contract exists, but no business implementation is connected."""


class SosEventNotFoundError(Exception):
    """The requested SOS event does not exist."""


class IllegalSosStatusTransitionError(Exception):
    """SOS 事件状态不允许回退或重复流转。"""


class CourseNotFoundError(Exception):
    """The requested course does not exist in the demo catalog."""


class VideoNotFoundError(Exception):
    """The requested course video file does not exist."""


COURSE_NOT_FOUND: ErrorPayload = {
    "error": {
        "code": "course_not_found",
        "message": "课程不存在",
    }
}

VIDEO_NOT_FOUND: ErrorPayload = {
    "error": {
        "code": "video_not_found",
        "message": "视频不存在",
    }
}


SOS_EVENT_NOT_FOUND: ErrorPayload = {
    "error": {
        "code": "sos_event_not_found",
        "message": "求助事件不存在",
    }
}

ILLEGAL_SOS_STATUS_TRANSITION: ErrorPayload = {
    "error": {
        "code": "illegal_sos_status_transition",
        "message": "求助事件状态不允许回退或重复流转",
    }
}


async def capability_not_implemented_handler(
    _request: Request, _error: CapabilityNotImplementedError
) -> JSONResponse:
    return JSONResponse(status_code=501, content=CAPABILITY_NOT_IMPLEMENTED)


async def sos_event_not_found_handler(
    _request: Request, _error: SosEventNotFoundError
) -> JSONResponse:
    return JSONResponse(status_code=404, content=SOS_EVENT_NOT_FOUND)


async def illegal_sos_status_transition_handler(
    _request: Request, _error: IllegalSosStatusTransitionError
) -> JSONResponse:
    return JSONResponse(status_code=409, content=ILLEGAL_SOS_STATUS_TRANSITION)


async def course_not_found_handler(
    _request: Request, _error: CourseNotFoundError
) -> JSONResponse:
    return JSONResponse(status_code=404, content=COURSE_NOT_FOUND)


async def video_not_found_handler(
    _request: Request, _error: VideoNotFoundError
) -> JSONResponse:
    return JSONResponse(status_code=404, content=VIDEO_NOT_FOUND)


async def validation_error_handler(
    _request: Request, error: RequestValidationError
) -> JSONResponse:
    return JSONResponse(status_code=422, content=to_validation_payload(error))
