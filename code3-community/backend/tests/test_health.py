from fastapi.testclient import TestClient

from silver_companion_community.main import create_app


def test_health_is_database_independent() -> None:
    response = TestClient(create_app()).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "community-backend"}
