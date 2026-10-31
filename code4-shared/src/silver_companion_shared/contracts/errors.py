from typing import Any, TypedDict


class ErrorDetail(TypedDict):
    code: str
    message: str


class ErrorPayload(TypedDict):
    error: ErrorDetail


class FieldError(TypedDict):
    path: str
    code: str
    message: str


class ValidationErrorDetail(TypedDict):
    code: str
    message: str
    fields: list[FieldError]


class ValidationErrorPayload(TypedDict):
    error: ValidationErrorDetail


CAPABILITY_NOT_IMPLEMENTED: ErrorPayload = {
    "error": {
        "code": "capability_not_implemented",
        "message": "该业务能力尚未接入",
    }
}

VALIDATION_FAILED_CODE = "validation_failed"
VALIDATION_FAILED_MESSAGE = "请求参数不合法"


def to_validation_payload(exc: Any) -> ValidationErrorPayload:
    """把 FastAPI 的 RequestValidationError 映射为统一校验错误体。

    每处校验失败输出一个字段项：路径用点号拼接（如 ``body.result``），
    错误码优先取 ``ctx["error"]``（pydantic 自定义错误），否则回落到 ``type``。
    """
    fields: list[FieldError] = []
    for error in exc.errors():
        loc = ".".join(str(part) for part in error.get("loc", ()))
        code = str(error.get("ctx", {}).get("error") or error.get("type", ""))
        fields.append(
            {
                "path": loc,
                "code": code,
                "message": str(error.get("msg", "")),
            }
        )
    return {
        "error": {
            "code": VALIDATION_FAILED_CODE,
            "message": VALIDATION_FAILED_MESSAGE,
            "fields": fields,
        }
    }
