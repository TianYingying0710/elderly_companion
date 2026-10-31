from typing import TypedDict


class ErrorDetail(TypedDict):
    code: str
    message: str


class ErrorPayload(TypedDict):
    error: ErrorDetail


CAPABILITY_NOT_IMPLEMENTED: ErrorPayload = {
    "error": {
        "code": "capability_not_implemented",
        "message": "该业务能力尚未接入",
    }
}
