# backend/tests/api/test_rules.py
from httpx import AsyncClient


async def test_get_rules(admin_client: AsyncClient):
    """Test fetching the GEDRules routing rules list (admin only)."""
    response = await admin_client.get("/api/v1/gedrules/rules")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
