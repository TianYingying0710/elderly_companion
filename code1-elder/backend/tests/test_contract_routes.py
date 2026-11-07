from fastapi.testclient import TestClient

from silver_companion_elder.main import create_app

ERROR = {
    "error": {
        "code": "capability_not_implemented",
        "message": "该业务能力尚未接入",
    }
}


def test_valid_contract_routes_return_only_the_not_implemented_error() -> None:
    client = TestClient(create_app())
    requests = [
        ("get", "/api/v1/courses", None),
        ("get", "/api/v1/courses/course-1", None),
        ("get", "/api/v1/learning-records", None),
        ("put", "/api/v1/learning-records/course-1", {"progress_percent": 25}),
    ]

    for method, path, body in requests:
        response = getattr(client, method)(path, json=body) if body is not None else getattr(client, method)(path)
        assert response.status_code == 501
        assert response.json() == ERROR
        assert set(response.json()) == {"error"}


def test_contract_routes_validate_input_before_reporting_missing_capability() -> None:
    client = TestClient(create_app())

    blank_id = client.get("/api/v1/courses/%20")
    assert blank_id.status_code == 422
    assert blank_id.json()["error"]["code"] == "validation_failed"
    assert any(f["path"] == "path.course_id" for f in blank_id.json()["error"]["fields"])

    out_of_range = client.put(
        "/api/v1/learning-records/course-1",
        json={"progress_percent": 101},
    )
    assert out_of_range.status_code == 422
    assert out_of_range.json()["error"]["code"] == "validation_failed"
    assert any(f["path"] == "body.progress_percent" for f in out_of_range.json()["error"]["fields"])


def test_openapi_contains_only_the_approved_business_paths() -> None:
    schema = create_app().openapi()
    business_paths = {path for path in schema["paths"] if path.startswith("/api/v1")}

    contract_only_paths = {
        "/api/v1/courses",
        "/api/v1/courses/{course_id}",
        "/api/v1/learning-records",
        "/api/v1/learning-records/{course_id}",
    }
    implemented_paths = {
        "/api/v1/sos-events",
        "/api/v1/sos-events/{event_id}",
    }
    assert business_paths == contract_only_paths | implemented_paths
    # 仅声明契约但未接业务的的才要求 501；已实现的 SOS 路由不在此列
    for path in contract_only_paths:
        for operation in schema["paths"][path].values():
            assert "501" in operation["responses"]


def test_health_remains_independent_from_business_dependencies() -> None:
    response = TestClient(create_app()).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "elder-backend"}
