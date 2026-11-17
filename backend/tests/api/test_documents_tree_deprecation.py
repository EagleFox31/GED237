"""GET /documents/tree is deprecated in favour of GET /spaces/tree (#279).

Clients learn it from the RFC 9745 Deprecation header, the successor link and the
OpenAPI schema; the answer itself does not change until the route is removed.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_the_old_tree_announces_its_deprecation_and_its_successor(
    auth_client: AsyncClient,
):
    old = await auth_client.get("/api/v1/documents/tree")
    successor = await auth_client.get("/api/v1/spaces/tree")
    assert old.status_code == 200, old.text
    assert old.headers["Deprecation"] == "@1794873600"
    assert old.headers["Link"] == '</api/v1/spaces/tree>; rel="successor-version"'
    assert old.json() == successor.json()
    assert "Deprecation" not in successor.headers


@pytest.mark.asyncio
async def test_the_api_schema_marks_only_the_old_tree_deprecated(
    auth_client: AsyncClient,
):
    paths = (await auth_client.get("/api/openapi.json")).json()["paths"]
    assert paths["/api/v1/documents/tree"]["get"]["deprecated"] is True
    assert "deprecated" not in paths["/api/v1/spaces/tree"]["get"]
