from datetime import datetime, timezone
from pathlib import Path
import tomllib

import pytest
from pydantic import ValidationError

from silver_companion_elder.schemas.courses import CourseDetail, CourseSummary
from silver_companion_elder.schemas.learning import LearningProgressUpdate, LearningRecord


def test_backend_declares_the_pydantic_v2_contract() -> None:
    project = tomllib.loads(Path("pyproject.toml").read_text(encoding="utf-8"))
    dependencies = project["project"]["dependencies"]
    assert "pydantic>=2,<3" in dependencies


def test_course_models_validate_stable_fields() -> None:
    summary = CourseSummary(
        id=" course-1 ",
        title="手机叫车",
        category="出行打车",
        description="认识叫车页面",
        duration_seconds=380,
    )
    detail = CourseDetail(**summary.model_dump(), outline=["认识页面"])

    assert summary.id == "course-1"
    assert detail.outline == ["认识页面"]
    with pytest.raises(ValidationError):
        CourseSummary(id=" ", title="课程", category="分类", description="说明", duration_seconds=0)
    with pytest.raises(ValidationError):
        CourseSummary(id="x", title="课程", category="分类", description="说明", duration_seconds=-1)


@pytest.mark.parametrize("value", [True, 1.5, -1, 101])
def test_learning_progress_rejects_non_strict_or_out_of_range_values(value: object) -> None:
    with pytest.raises(ValidationError):
        LearningProgressUpdate(progress_percent=value)


def test_learning_record_requires_timezone_aware_update_time() -> None:
    record = LearningRecord(
        course_id="course-1",
        progress_percent=25,
        updated_at=datetime(2026, 10, 26, 9, 0, tzinfo=timezone.utc),
    )
    assert record.progress_percent == 25
    with pytest.raises(ValidationError):
        LearningRecord(course_id="course-1", progress_percent=25, updated_at=datetime(2026, 10, 26, 9, 0))
