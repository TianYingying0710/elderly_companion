from typing import Protocol

from ..schemas.health_data import HealthOverviewDto
from ..service_errors import HealthDataSourceUnavailableError


class HealthDataProvider(Protocol):
    def get_overview(self, elder_id: str) -> HealthOverviewDto: ...


class UnavailableHealthDataProvider:
    def get_overview(self, elder_id: str) -> HealthOverviewDto:
        raise HealthDataSourceUnavailableError(elder_id)
