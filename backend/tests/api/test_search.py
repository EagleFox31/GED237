from httpx import AsyncClient


async def test_search_documents(auth_client: AsyncClient):
    """Test the full-text search endpoint."""
    response = await auth_client.get("/api/v1/search/", params={"q": "test"})
    assert response.status_code == 200
    data = response.json()
    assert "hits" in data
    assert isinstance(data["hits"], list)
    assert "total_count" in data


async def test_search_documents_with_filters(auth_client: AsyncClient):
    """Test the full-text search endpoint with metadata filters."""
    response = await auth_client.get(
        "/api/v1/search/", params={"q": "rapport", "status": "draft"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "hits" in data
