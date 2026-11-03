import pytest

from silver_companion_guardian.service_errors import HealthDataSourceUnavailableError
from silver_companion_guardian.services.health_data import HealthDataService


def test_default_service_reports_unavailable_source():
    with pytest.raises(HealthDataSourceUnavailableError):
        HealthDataService().get_overview("elder_1")


def test_service_accepts_injected_provider():
    class Provider:
        def get_overview(self, elder_id):
            return {"elder_id": elder_id, "metrics": [], "updated_at": None, "source_status": "available"}

    result = HealthDataService(Provider()).get_overview("elder_1")
    assert result.elder_id == "elder_1"
