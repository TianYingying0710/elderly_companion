from ..services.health_data import HealthDataService


def get_health_data_service() -> HealthDataService:
    return HealthDataService()
