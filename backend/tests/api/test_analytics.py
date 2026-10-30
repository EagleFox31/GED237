from httpx import AsyncClient


async def test_get_tenant_analytics(auth_client: AsyncClient):
    """Test that an authenticated user can fetch their tenant's analytics."""
    response = await auth_client.get("/api/v1/analytics/tenant")
    assert response.status_code == 200
    data = response.json()
    assert "users" in data
    assert "documents" in data


async def test_get_platform_analytics_denied_standard_user(auth_client: AsyncClient):
    """Test that a standard user cannot access the platform global stats."""
    response = await auth_client.get("/api/v1/analytics/platform")
    assert response.status_code == 403
    data = response.json()
    assert "detail" in data
