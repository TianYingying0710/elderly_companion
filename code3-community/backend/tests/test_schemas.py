"""schema 层测试：枚举取值、终态必填、硬件求助不得携带原因、时间必须带时区。"""

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from silver_companion_community.schemas.courses import CourseStatusUpdate
from silver_companion_community.schemas.knowledge import KnowledgeDocUpdate
from silver_companion_community.schemas.rescue import (
    RescueIncidentSummary,
    RescueSource,
    RescueStatus,
    RescueTransition,
)
from silver_companion_community.schemas.service import ServiceStatus, ServiceTransition

AWARE = datetime(2026, 10, 29, 1, 7, tzinfo=timezone.utc)


def _incident(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "id": "SOS-20261029-001",
        "elder_name": "王建国",
        "source": RescueSource.hardware_button,
        "reason": "",
        "location": "幸福里 3 栋 2 单元 502",
        "status": RescueStatus.pending,
        "reported_at": AWARE,
    }
    base.update(overrides)
    return base


def test_transition_to_completed_requires_a_result() -> None:
    with pytest.raises(ValidationError):
        RescueTransition(to=RescueStatus.completed)
    with pytest.raises(ValidationError):
        RescueTransition(to=RescueStatus.completed, result="   ")

    allowed = RescueTransition(to=RescueStatus.completed, result="已上门确认老人无碍")
    assert allowed.result == "已上门确认老人无碍"


def test_intermediate_transitions_do_not_require_a_result() -> None:
    assert RescueTransition(to=RescueStatus.en_route).result is None
    assert RescueTransition(to=RescueStatus.arrived).result is None


def test_hardware_button_incident_cannot_carry_a_reason() -> None:
    with pytest.raises(ValidationError):
        RescueIncidentSummary(**_incident(source=RescueSource.hardware_button, reason="身体不适"))

    software = RescueIncidentSummary(
        **_incident(source=RescueSource.app_request, reason="身体不适")
    )
    assert software.reason == "身体不适"


def test_reported_at_must_be_timezone_aware() -> None:
    with pytest.raises(ValidationError):
        RescueIncidentSummary(**_incident(reported_at=datetime(2026, 10, 29, 1, 7)))


def test_service_completion_requires_a_note() -> None:
    with pytest.raises(ValidationError):
        ServiceTransition(to=ServiceStatus.completed)
    with pytest.raises(ValidationError):
        ServiceTransition(to=ServiceStatus.completed, note="  ")

    assert ServiceTransition(to=ServiceStatus.completed, note="已协助填写申请表").note


def test_knowledge_update_requires_at_least_one_field() -> None:
    with pytest.raises(ValidationError):
        KnowledgeDocUpdate()
    with pytest.raises(ValidationError):
        KnowledgeDocUpdate(content="   ")

    assert KnowledgeDocUpdate(status="enabled").status is not None


def test_course_status_update_rejects_unknown_values() -> None:
    with pytest.raises(ValidationError):
        CourseStatusUpdate(status="bogus")
