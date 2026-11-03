from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class HealthMetricDto(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: Literal["heart_rate", "blood_pressure", "sleep"]
    label: str
    value: str
    unit: str
    badge: str | None = None


class HealthOverviewDto(BaseModel):
    model_config = ConfigDict(extra="forbid")

    elder_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    metrics: list[HealthMetricDto]
    updated_at: datetime | None
    source_status: Literal["unavailable", "available"]

    @field_validator("updated_at")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("updated_at must include timezone")
        return value


class HealthDataError(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    message: str
    fields: list[str]


class HealthDataErrorEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    error: HealthDataError
