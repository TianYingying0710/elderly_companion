"""Transport-level contracts that do not depend on application internals."""

from .errors import CAPABILITY_NOT_IMPLEMENTED, ErrorDetail, ErrorPayload
from .health import HealthPayload

__all__ = [
    "CAPABILITY_NOT_IMPLEMENTED",
    "ErrorDetail",
    "ErrorPayload",
    "HealthPayload",
]
