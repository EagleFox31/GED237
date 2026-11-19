"""Position in the workflow shown in the document list (L12-7).

A document in review shows who holds it and at which step: "Chez X (étape n/N)".
"""

import io

import pytest
from httpx import AsyncClient
from sqlalchemy import event


async def _upload(client: AsyncClient, title: str) -> dict:
    resp = await client.post(
        "/api/v1/documents/upload",
        files={"file": (f"{title}.txt", io.BytesIO(title.encode()), "text/plain")},
        data={"title": title},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _submit(client: AsyncClient, doc_id: str, assignee: str, steps: int) -> None:
    resp = await client.post(
        f"/api/v1/workflows/document/{doc_id}/steps",
        json=[
            {
                "document_id": doc_id,
                "step_order": order,
                "label": f"Visa {order}",
                "assigned_to": assignee,
            }
            for order in range(1, steps + 1)
        ],
    )
    assert resp.status_code == 201, resp.text


async def _act(client: AsyncClient, doc: dict, outcome: str) -> None:
    pending = (await client.get("/api/v1/workflows/pending")).json()
    step = next(t for t in pending if t["document_id"] == doc["id"])
    resp = await client.post(
        f"/api/v1/workflows/step/{step['id']}/actions",
        json={
            "action_type": "visa",
            "outcome": outcome,
            "document_version_id": doc["current_version_id"],
            "comment": "Motif",
        },
    )
    assert resp.status_code == 200, resp.text


async def _listed(client: AsyncClient, doc_id: str) -> dict:
    docs = (await client.get("/api/v1/documents/")).json()
    return next(d for d in docs if d["id"] == doc_id)


@pytest.mark.asyncio
async def test_position_follows_the_workflow(auth_client: AsyncClient, db_seed):
    me = str(db_seed["user_id"])
    doc = await _upload(auth_client, "Circuit deux visas")
    await _submit(auth_client, doc["id"], me, steps=2)

    item = await _listed(auth_client, doc["id"])
    assert (item["workflow_step_order"], item["workflow_step_count"]) == (1, 2)
    assert item["workflow_assignee_name"] == "Test User"

    await _act(auth_client, doc, "accepted")
    item = await _listed(auth_client, doc["id"])
    assert (item["workflow_step_order"], item["workflow_step_count"]) == (2, 2)


@pytest.mark.asyncio
async def test_no_position_outside_review(auth_client: AsyncClient, db_seed):
    me = str(db_seed["user_id"])
    draft = await _upload(auth_client, "Brouillon")
    returned = await _upload(auth_client, "Retourne")
    await _submit(auth_client, returned["id"], me, steps=2)
    await _act(auth_client, returned, "returned")

    for doc in (draft, returned):
        item = await _listed(auth_client, doc["id"])
        assert item["workflow_step_order"] is None
        assert item["workflow_step_count"] is None
        assert item["workflow_assignee_name"] is None

    # A new cycle counts only its own steps, not the cancelled ones.
    await _submit(auth_client, returned["id"], me, steps=1)
    item = await _listed(auth_client, returned["id"])
    assert (item["workflow_step_order"], item["workflow_step_count"]) == (1, 1)


@pytest.mark.asyncio
async def test_position_costs_one_query_whatever_the_page_size(
    auth_client: AsyncClient, db_seed, test_engine
):
    me = str(db_seed["user_id"])
    statements: list[str] = []

    def count(_conn, _cursor, statement, *_args):
        statements.append(statement)

    async def list_queries() -> int:
        statements.clear()
        event.listen(test_engine.sync_engine, "before_cursor_execute", count)
        try:
            resp = await auth_client.get("/api/v1/documents/")
        finally:
            event.remove(test_engine.sync_engine, "before_cursor_execute", count)
        assert resp.status_code == 200
        return len(statements)

    first = await _upload(auth_client, "Page 1")
    await _submit(auth_client, first["id"], me, steps=1)
    with_one = await list_queries()

    for title in ("Page 2", "Page 3", "Page 4"):
        doc = await _upload(auth_client, title)
        await _submit(auth_client, doc["id"], me, steps=2)
    assert await list_queries() == with_one
