"""契约路由测试：能力未接入返回 501，输入非法返回 422。

本文件先于实现编写（TDD 的 RED 步骤）。实现落地前，所有路由断言都会因 404 失败。
"""

from fastapi.testclient import TestClient

from silver_companion_community.main import create_app

NOT_IMPLEMENTED = {
    "error": {
        "code": "capability_not_implemented",
        "message": "该业务能力尚未接入",
    }
}

# 12 个操作：4 个资源域，每域 列表 / 详情 / 写入 各一个。
VALID_CALLS = [
    ("get", "/api/v1/rescue-incidents", None),
    ("get", "/api/v1/rescue-incidents/incident-1", None),
    ("post", "/api/v1/rescue-incidents/incident-1/transitions", {"to": "en_route"}),
    ("get", "/api/v1/service-tasks", None),
    ("get", "/api/v1/service-tasks/task-1", None),
    ("post", "/api/v1/service-tasks/task-1/transitions", {"to": "in_service"}),
    ("get", "/api/v1/knowledge-docs", None),
    ("get", "/api/v1/knowledge-docs/doc-1", None),
    ("patch", "/api/v1/knowledge-docs/doc-1", {"status": "enabled"}),
    ("get", "/api/v1/courses", None),
    ("get", "/api/v1/courses/course-1", None),
    ("patch", "/api/v1/courses/course-1", {"status": "published"}),
]

EXPECTED_PATHS = {
    "/api/v1/rescue-incidents",
    "/api/v1/rescue-incidents/{incident_id}",
    "/api/v1/rescue-incidents/{incident_id}/transitions",
    "/api/v1/service-tasks",
    "/api/v1/service-tasks/{task_id}",
    "/api/v1/service-tasks/{task_id}/transitions",
    "/api/v1/knowledge-docs",
    "/api/v1/knowledge-docs/{doc_id}",
    "/api/v1/courses",
    "/api/v1/courses/{course_id}",
}


def test_valid_calls_report_missing_capability_only() -> None:
    client = TestClient(create_app())

    for method, path, body in VALID_CALLS:
        response = getattr(client, method)(path, json=body) if body is not None else getattr(client, method)(path)
        assert response.status_code == 501, f"{method.upper()} {path} -> {response.status_code}"
        assert response.json() == NOT_IMPLEMENTED, f"{method.upper()} {path} body mismatch"
        assert set(response.json()) == {"error"}


def test_invalid_input_is_rejected_before_missing_capability() -> None:
    client = TestClient(create_app())

    # 空白 ID 不得被当成合法资源
    blank_course = client.get("/api/v1/courses/%20")
    assert blank_course.status_code == 422
    assert blank_course.json()["error"]["code"] == "validation_failed"
    blank_rescue = client.get("/api/v1/rescue-incidents/%20")
    assert blank_rescue.status_code == 422
    assert any(f["path"] == "path.incident_id" for f in blank_rescue.json()["error"]["fields"])

    # 未知枚举值
    assert client.post(
        "/api/v1/rescue-incidents/incident-1/transitions", json={"to": "bogus"}
    ).status_code == 422
    assert client.patch("/api/v1/courses/course-1", json={"status": "bogus"}).status_code == 422
    assert client.patch(
        "/api/v1/knowledge-docs/doc-1", json={"status": "bogus"}
    ).status_code == 422

    # 进入终态必须带处理结果
    terminal = client.post(
        "/api/v1/rescue-incidents/incident-1/transitions", json={"to": "completed"}
    )
    assert terminal.status_code == 422
    assert terminal.json()["error"]["code"] == "validation_failed"
    # 模型级校验器（model_validator）的定位路径是请求体根 "body"
    assert any(f["path"] == "body" for f in terminal.json()["error"]["fields"])

    # 分页边界
    assert client.get("/api/v1/rescue-incidents", params={"limit": 0}).status_code == 422
    assert client.get("/api/v1/rescue-incidents", params={"limit": 101}).status_code == 422
    assert client.get("/api/v1/rescue-incidents", params={"limit": 20}).status_code == 501


def test_openapi_exposes_the_approved_paths_with_501_responses() -> None:
    schema = create_app().openapi()
    business_paths = {path for path in schema["paths"] if path.startswith("/api/v1")}

    assert business_paths == EXPECTED_PATHS
    for path in business_paths:
        for method, operation in schema["paths"][path].items():
            assert "501" in operation["responses"], f"{method.upper()} {path} missing 501"


def test_health_stays_independent_from_business_routes() -> None:
    response = TestClient(create_app()).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "community-backend"}
