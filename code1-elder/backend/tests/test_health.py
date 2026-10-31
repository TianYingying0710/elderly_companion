from fastapi.testclient import TestClient

from silver_companion_elder.main import create_app


def test_health_is_database_independent() -> None:
    response = TestClient(create_app()).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "elder-backend"}


def test_capacitor_android_origin_is_allowed() -> None:
    response = TestClient(create_app()).options(
        "/health",
        headers={
            "Origin": "https://localhost",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://localhost"
