from typing import Literal, TypedDict


class HealthPayload(TypedDict):
    status: Literal["ok"]
    service: str
