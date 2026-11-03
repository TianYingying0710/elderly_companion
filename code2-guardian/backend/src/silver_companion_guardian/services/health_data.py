from ..providers.health_data import HealthDataProvider, UnavailableHealthDataProvider
from ..schemas.health_data import HealthOverviewDto


class HealthDataService:
    def __init__(self, provider: HealthDataProvider | None = None) -> None:
        self._provider = provider or UnavailableHealthDataProvider()

    def get_overview(self, elder_id: str) -> HealthOverviewDto:
        result = self._provider.get_overview(elder_id)
        return result if isinstance(result, HealthOverviewDto) else HealthOverviewDto.model_validate(result)
