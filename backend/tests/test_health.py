"""Basic health and setup tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    """Test health check endpoint."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "pharma-erp-backend"


@pytest.mark.asyncio
async def test_openapi_docs(client: AsyncClient):
    """Test OpenAPI docs are accessible."""
    response = await client.get("/docs")
    assert response.status_code == 200
    assert "openapi" in response.text.lower() or "swagger" in response.text.lower()


@pytest.mark.asyncio
async def test_openapi_json(client: AsyncClient):
    """Test OpenAPI JSON spec."""
    response = await client.get("/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    assert "info" in spec
    assert spec["info"]["title"] == "Walmus Pharma ERP API"


@pytest.mark.asyncio
async def test_medicine_list_accepts_dropdown_limit(client: AsyncClient):
    """Invoice forms load up to 500 medicines for their dropdowns."""
    response = await client.get("/api/medicines", params={"limit": 500})
    assert response.status_code == 200
    assert "items" in response.json()