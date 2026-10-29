import io

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_spaces_tree_and_documents(auth_client: AsyncClient, db_seed):
    upload_response = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("space-note.txt", io.BytesIO(b"space content"), "text/plain")},
        data={
            "title": "Document espace",
            "document_category_id": str(db_seed["category_id"]),
        },
    )
    assert upload_response.status_code == 201
    uploaded = upload_response.json()

    tree_response = await auth_client.get("/api/v1/spaces/tree")
    assert tree_response.status_code == 200
    tree = tree_response.json()
    assert isinstance(tree, list)
    assert tree
    assert set(tree[0].keys()) == {
        "id",
        "name",
        "code",
        "level",
        "parent_id",
        "children",
    }

    documents_response = await auth_client.get(
        "/api/v1/spaces/documents",
        params={"org_unit_id": str(db_seed["org_unit_id"]), "recursive": "true"},
    )
    assert documents_response.status_code == 200

    documents = documents_response.json()
    assert isinstance(documents, list)
    assert any(doc["id"] == uploaded["id"] for doc in documents)
    assert all("classification_status" in doc for doc in documents)
    assert all("logical_space_path" in doc for doc in documents)

    workspace_response = await auth_client.get(
        "/api/v1/documents/workspace",
        params={"org_unit_id": str(db_seed["org_unit_id"]), "recursive": "true"},
    )
    assert workspace_response.status_code == 200

    workspace_ids = {doc["id"] for doc in workspace_response.json()}
    spaces_ids = {doc["id"] for doc in documents}
    assert spaces_ids == workspace_ids
