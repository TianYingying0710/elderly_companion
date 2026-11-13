"""跨端验收业务流：只依赖 HTTP 客户端与显式状态。

不启动进程、不读环境变量、不知道端口或临时目录。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

from support import Client

SCHEDULED_AT = "2026-11-14T06:30:00+00:00"
SERVICE_NOTE = "自动化验收服务记录"


@dataclass(frozen=True)
class ElderState:
    elder_id: str
    course_id: str
    sos_id: str


@dataclass(frozen=True)
class CommunityState:
    task_id: str


def _path_id(value: str) -> str:
    return quote(value, safe="")


def _check(step: str, condition: bool, message: str, payload: Any) -> None:
    if not condition:
        raise AssertionError(f"[{step}] {message}: {payload!r}")


def run_elder_checks(client: Client, run_id: str) -> ElderState:
    client.request_json(
        "GET",
        "/health",
        200,
        step="S01",
        description="elder /health",
        validate=lambda payload: _check(
            "S01", payload.get("status") == "ok", "status is not ok", payload
        ),
    )

    def validate_catalog(catalog: Any) -> None:
        _check("S02", isinstance(catalog, list), "catalog is not a list", catalog)
        for course in catalog:
            for field in ("id", "title", "category", "duration_seconds"):
                _check("S02", field in course, f"course missing {field}", course)

    client.request_json(
        "GET",
        "/api/v1/courses",
        200,
        step="S02",
        description="elder course catalog",
        validate=validate_catalog,
    )

    def validate_created(course: Any) -> None:
        _check("S03", course["id"].startswith("course-"), "unexpected course id", course)
        _check(
            "S03",
            course["title"] == f"自动化验收课程 {run_id}",
            "title mismatch",
            course,
        )
        _check("S03", course["outline"] == ["第一步", "第二步"], "outline mismatch", course)
        _check("S03", course["status"] == "published", "new course is not published", course)
        _check("S03", course["editable"] is True, "new course is not editable", course)

    created = client.request_json(
        "POST",
        "/api/v1/courses",
        201,
        step="S03",
        description="create course",
        json={
            "title": f"自动化验收课程 {run_id}",
            "category": "自动化验收",
            "description": "自动化验收创建的课程，不含真实个人信息",
            "duration_seconds": 60,
            "outline": ["第一步", "第二步"],
        },
        validate=validate_created,
    )
    course_id = created["id"]

    def validate_record(record: Any) -> None:
        _check("S04", record["course_id"] == course_id, "course id mismatch", record)
        _check("S04", record["progress_percent"] == 42, "progress mismatch", record)

    client.request_json(
        "PUT",
        f"/api/v1/learning-records/{_path_id(course_id)}",
        200,
        step="S04",
        description="write learning progress 42",
        json={"progress_percent": 42},
        validate=validate_record,
    )

    def validate_sos(event: Any) -> None:
        _check("S05", event["status"] == "pending", "status is not pending", event)
        _check("S05", event["note"] == "自动化验收求助", "note mismatch", event)

    sos = client.request_json(
        "POST",
        "/api/v1/sos-events",
        201,
        step="S05",
        description="create SOS event",
        json={"elder_id": run_id, "note": "自动化验收求助"},
        validate=validate_sos,
    )
    sos_id = sos["id"]

    def validate_events(events: Any) -> None:
        _check("S06", isinstance(events, list), "events is not a list", events)
        _check(
            "S06",
            any(event["id"] == sos_id for event in events),
            "created event missing",
            events,
        )

    client.request_json(
        "GET",
        f"/api/v1/sos-events?elder_id={quote(run_id, safe='')}",
        200,
        step="S06",
        description="list SOS by elder_id",
        validate=validate_events,
    )

    client.request_json(
        "PATCH",
        f"/api/v1/sos-events/{_path_id(sos_id)}",
        200,
        step="S07",
        description="SOS pending -> processing",
        json={"status": "processing"},
        validate=lambda payload: _check(
            "S07", payload["status"] == "processing", "status mismatch", payload
        ),
    )

    client.request_json(
        "PATCH",
        f"/api/v1/sos-events/{_path_id(sos_id)}",
        409,
        step="S08",
        description="SOS regression rejected",
        json={"status": "pending"},
        validate=lambda payload: _check(
            "S08",
            payload["error"]["code"] == "illegal_sos_status_transition",
            "unexpected error code",
            payload,
        ),
    )

    client.request_json(
        "POST",
        f"/api/v1/sos-events/{_path_id(sos_id)}/transitions",
        200,
        step="S09",
        description="SOS processing -> resolved via POST alias",
        json={"status": "resolved"},
        validate=lambda payload: _check(
            "S09", payload["status"] == "resolved", "status mismatch", payload
        ),
    )

    return ElderState(run_id, course_id, sos_id)


def run_guardian_checks(client: Client, run_id: str) -> None:
    client.request_json(
        "GET",
        "/health",
        200,
        step="S10",
        description="guardian /health",
        validate=lambda payload: _check(
            "S10", payload.get("status") == "ok", "status is not ok", payload
        ),
    )
    client.request_json(
        "GET",
        f"/api/v1/health-overview/{quote(run_id, safe='')}",
        503,
        step="S11",
        description="guardian health source honestly unavailable",
        validate=lambda payload: _check(
            "S11",
            payload["error"]["code"] == "health_data_source_unavailable",
            "unexpected error code",
            payload,
        ),
    )


def run_community_checks(client: Client, run_id: str) -> CommunityState:
    client.request_json(
        "GET",
        "/health",
        200,
        step="S12",
        description="community /health",
        validate=lambda payload: _check(
            "S12", payload.get("status") == "ok", "status is not ok", payload
        ),
    )
    created = client.request_json(
        "POST",
        "/api/v1/service-tasks",
        201,
        step="S13",
        description="create service task",
        json={
            "title": f"自动化验收服务 {run_id}",
            "elder_name": "自动化验收老人",
            "category": "自动化验收",
            "scheduled_at": SCHEDULED_AT,
            "location": "自动化验收地点",
            "description": "自动化验收创建的服务任务，不含真实个人信息",
        },
        validate=lambda payload: _check(
            "S13", payload["status"] == "pending", "status mismatch", payload
        ),
    )
    task_id = created["id"]
    client.request_json(
        "POST",
        f"/api/v1/service-tasks/{_path_id(task_id)}/accept",
        200,
        step="S14",
        description="accept service task",
        validate=lambda payload: _check(
            "S14", payload["status"] == "in_service", "status mismatch", payload
        ),
    )
    client.request_json(
        "POST",
        f"/api/v1/service-tasks/{_path_id(task_id)}/complete",
        200,
        step="S15",
        description="complete service task",
        json={"note": SERVICE_NOTE},
        validate=lambda payload: _check(
            "S15",
            payload["status"] == "completed" and payload["note"] == SERVICE_NOTE,
            "completed state or note mismatch",
            payload,
        ),
    )
    client.request_json(
        "POST",
        f"/api/v1/service-tasks/{_path_id(task_id)}/complete",
        409,
        step="S16",
        description="repeat completion rejected",
        json={"note": SERVICE_NOTE},
        validate=lambda payload: _check(
            "S16",
            payload["error"]["code"] == "invalid_state_transition",
            "unexpected error code",
            payload,
        ),
    )
    return CommunityState(task_id)


def run_elder_restart_checks(client: Client, state: ElderState) -> None:
    client.request_json(
        "GET",
        f"/api/v1/sos-events?elder_id={quote(state.elder_id, safe='')}",
        200,
        step="S17",
        description="SOS survived elder restart",
        validate=lambda events: _check(
            "S17",
            any(
                event["id"] == state.sos_id and event["status"] == "resolved"
                for event in events
            ),
            "resolved event missing after restart",
            events,
        ),
    )
    client.request_json(
        "GET",
        "/api/v1/courses",
        200,
        step="S18",
        description="course survived elder restart",
        validate=lambda catalog: _check(
            "S18",
            any(course["id"] == state.course_id for course in catalog),
            "created course missing after restart",
            catalog,
        ),
    )
    client.request_json(
        "GET",
        "/api/v1/learning-records",
        200,
        step="S19",
        description="learning progress survived elder restart",
        validate=lambda records: _check(
            "S19",
            any(
                record["course_id"] == state.course_id
                and record["progress_percent"] == 42
                for record in records
            ),
            "progress 42 missing after restart",
            records,
        ),
    )


def run_community_restart_checks(client: Client, state: CommunityState) -> None:
    client.request_json(
        "GET",
        f"/api/v1/service-tasks/{_path_id(state.task_id)}",
        200,
        step="S20",
        description="service task survived community restart",
        validate=lambda task: _check(
            "S20",
            task["status"] == "completed" and task["note"] == SERVICE_NOTE,
            "completed state or note mismatch after restart",
            task,
        ),
    )
