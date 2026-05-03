from httpx import AsyncClient


async def test_get_tenants(auth_client: AsyncClient):
    """Test fetching tenants list as standard user (sees only own tenant)."""
    response = await auth_client.get("/api/v1/tenants/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


async def test_create_tenant_forbidden_for_standard_user(auth_client: AsyncClient):
    """Test that creating a tenant is forbidden for standard users (super_admin only)."""
    response = await auth_client.post(
        "/api/v1/tenants/",
        json={"name": "Direction Générale des Impôts", "domain": "dgi.gov.cm"},
    )
    assert response.status_code == 403
