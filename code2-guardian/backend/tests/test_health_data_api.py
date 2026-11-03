import httpx
import pytest


@pytest.fixture
def anyio_backend():
    return "asyncio"

from silver_companion_guardian.main import create_app


@pytest.mark.anyio
async def test_health_overview_returns_structured_503_without_source():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app()), base_url="http://test") as client:
        response = await client.get("/api/v1/health-overview/elder_1")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "health_data_source_unavailable"
    assert response.json()["error"]["fields"] == []


@pytest.mark.anyio
async def test_health_overview_rejects_invalid_elder_id():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app()), base_url="http://test") as client:
        response = await client.get("/api/v1/health-overview/bad%20id")
    assert response.status_code == 422


@pytest.mark.anyio
async def test_process_health_is_independent_from_business_data_source():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app()), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
