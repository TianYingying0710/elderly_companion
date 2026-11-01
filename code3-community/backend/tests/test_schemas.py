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
from silver_companion_community.schemas.service import (
    ServiceTaskComplete,
    ServiceTaskCreate,
)

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


def _service_create(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "title": "代缴水电费",
        "elder_name": "示例老人 B",
        "category": "代办服务",
        "scheduled_at": AWARE,
        "location": "XX 社区服务中心窗口",
        "description": "按老人委托到窗口代缴本月水电费",
    }
    base.update(overrides)
    return base


def test_service_completion_requires_a_note() -> None:
    with pytest.raises(ValidationError):
        ServiceTaskComplete(note="")
    with pytest.raises(ValidationError):
        ServiceTaskComplete(note="   ")

    assert ServiceTaskComplete(note=" 已协助填写申请表 ").note == "已协助填写申请表"


def test_service_create_forbids_server_owned_fields() -> None:
    for field in ("id", "status", "note"):
        with pytest.raises(ValidationError):
            ServiceTaskCreate(**_service_create(**{field: "client-value"}))


def test_service_create_requires_every_business_field() -> None:
    for field in ("title", "elder_name", "category", "scheduled_at", "location", "description"):
        payload = _service_create()
        payload.pop(field)
        with pytest.raises(ValidationError):
            ServiceTaskCreate(**payload)

    with pytest.raises(ValidationError):
        ServiceTaskCreate(**_service_create(scheduled_at=datetime(2026, 11, 1, 14, 0)))

    created = ServiceTaskCreate(**_service_create())
    assert created.title == "代缴水电费"


TEXT_LIMITS = [
    ("title", 100),
    ("elder_name", 100),
    ("category", 100),
    ("location", 200),
    ("description", 2000),
]


@pytest.mark.parametrize(("field", "limit"), TEXT_LIMITS)
def test_service_create_accepts_text_exactly_at_the_limit(field: str, limit: int) -> None:
    created = ServiceTaskCreate(**_service_create(**{field: "长" * limit}))

    assert len(getattr(created, field)) == limit


@pytest.mark.parametrize(("field", "limit"), TEXT_LIMITS)
def test_service_create_rejects_text_one_character_over_the_limit(field: str, limit: int) -> None:
    with pytest.raises(ValidationError):
        ServiceTaskCreate(**_service_create(**{field: "长" * (limit + 1)}))


def test_service_create_measures_the_limit_after_stripping_whitespace() -> None:
    created = ServiceTaskCreate(**_service_create(title="长" * 100 + "   "))

    assert created.title == "长" * 100


def test_service_completion_note_has_an_upper_bound() -> None:
    assert len(ServiceTaskComplete(note="记" * 2000).note) == 2000

    with pytest.raises(ValidationError):
        ServiceTaskComplete(note="记" * 2001)


def test_service_completion_forbids_unknown_fields() -> None:
    for extra in ({"status": "completed"}, {"id": "client-id"}):
        with pytest.raises(ValidationError):
            ServiceTaskComplete(note="已上门确认老人无碍", **extra)


def test_knowledge_update_requires_at_least_one_field() -> None:
    with pytest.raises(ValidationError):
        KnowledgeDocUpdate()
    with pytest.raises(ValidationError):
        KnowledgeDocUpdate(content="   ")

    assert KnowledgeDocUpdate(status="enabled").status is not None


def test_course_status_update_rejects_unknown_values() -> None:
    with pytest.raises(ValidationError):
        CourseStatusUpdate(status="bogus")
