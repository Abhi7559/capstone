import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock
from main import app
from core.config import settings


@pytest.mark.asyncio(loop_scope="session")
async def test_service_health_endpoint_healthy():
    """API 23: Service Health endpoint returns 200 OK when DB and Redis are connected."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Mock Redis.ping so tests don't require external Redis running in unit test runner
        with patch("main.Redis.from_url") as mock_from_url:
            mock_instance = AsyncMock()
            mock_instance.ping.return_value = True
            mock_from_url.return_value = mock_instance

            versioned_path = f"{settings.API_V1_PREFIX}/health"
            response = await client.get(versioned_path)
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert "timestamp" in data
            assert data["services"]["database"] == "connected"
            assert data["services"]["redis"] == "connected"


@pytest.mark.asyncio(loop_scope="session")
async def test_service_health_endpoint_degraded():
    """API 23: Service Health endpoint returns 503 when Redis or DB is disconnected."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        with patch("main.Redis.from_url") as mock_from_url:
            mock_instance = AsyncMock()
            mock_instance.ping.side_effect = Exception("Connection refused")
            mock_from_url.return_value = mock_instance

            versioned_path = f"{settings.API_V1_PREFIX}/health"
            response = await client.get(versioned_path)
            assert response.status_code == 503
            data = response.json()
            assert data["status"] == "unhealthy"
            assert data["services"]["redis"] == "disconnected"


@pytest.mark.asyncio(loop_scope="session")
async def test_openapi_docs():
    """Ensure OpenAPI docs are available and contain only 1 health endpoint."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        docs_response = await client.get("/docs")
        assert docs_response.status_code == 200

        openapi_url = f"{settings.API_V1_PREFIX}/openapi.json"
        openapi_response = await client.get(openapi_url)
        assert openapi_response.status_code == 200
        schema = openapi_response.json()
        assert schema["info"]["title"] == settings.PROJECT_NAME

        # Verify there is exactly ONE health route in Swagger paths
        health_paths = [p for p in schema["paths"].keys() if "health" in p]
        assert len(health_paths) == 1
        assert health_paths[0] == f"{settings.API_V1_PREFIX}/health"
