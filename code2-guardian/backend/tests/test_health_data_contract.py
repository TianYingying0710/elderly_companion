from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from silver_companion_guardian.schemas.health_data import HealthMetricDto, HealthOverviewDto


def test_health_overview_accepts_timezone_aware_timestamp_and_fixed_metric_keys():
    overview = HealthOverviewDto(
        elder_id="elder_1",
        metrics=[
            HealthMetricDto(
                key="heart_rate", label="心率", value="72", unit="次/分", badge="正常"
            )
        ],
        updated_at=datetime(2026, 11, 3, 8, 20, tzinfo=timezone.utc),
        source_status="available",
    )

    assert overview.metrics[0].key == "heart_rate"


def test_health_overview_rejects_naive_timestamp_and_unknown_metric_key():
    with pytest.raises(ValidationError):
        HealthOverviewDto(
            elder_id="elder_1",
            metrics=[HealthMetricDto(key="other", label="", value="", unit="", badge=None)],
            updated_at=datetime(2026, 11, 3, 8, 20),
            source_status="available",
        )
