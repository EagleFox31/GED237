"""Every role gets 404 outside its perimeter, 403 inside it without the right (#247).

The perimeter is the one GET /documents lists: the unit for manager and reader,
the unit tree for unit_admin, own documents for collaborator. A document outside
it answers like a missing one, so a by-id call never confirms that it exists.

Tree (see test_unit_admin_read_scope): A (seeded unit) > A1 > A2, and B beside A.
The seeded user owns every document but ``own`` (B, owned by the collaborator).
"""

import uuid

import pytest
from sqlalchemy import update

from app.models.document import Document
from tests.api.test_unit_admin_read_scope import tree  # noqa: F401  (fixture)

DOCUMENTS = "/api/v1/documents"
HIDDEN = (404, "Document not found")


def _code(response):
    if response.status_code == 404:
        return (404, response.json().get("detail"))
    return response.status_code


def _as(client_as, db_seed, tree, role, unit, user_id=None):  # noqa: F811
    return client_as(
        role,
        id=user_id or uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=tree["units"][unit],
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["manager", "reader"])
async def test_manager_and_reader_see_their_unit_only(
    client_as,
    db_seed,
    tree,  # noqa: F811
    role,
):
    ids = tree["ids"]
    async with _as(client_as, db_seed, tree, role, "a1") as client:
        # A sub-unit and a sibling unit are both outside "own unit".
        outside = {
            key: _code(await client.get(f"{DOCUMENTS}/{ids[key]}"))
            for key in ("a", "a2", "b")
        }
        inside = await client.get(f"{DOCUMENTS}/{ids['a1']}")
        # Inside the unit, a document of someone else: no right to change it.
        no_right = await client.patch(
            f"{DOCUMENTS}/{ids['a1']}", json={"title": "Renomme"}
        )
        hidden_patch = await client.patch(
            f"{DOCUMENTS}/{ids['b']}", json={"title": "Renomme"}
        )
    assert outside == {key: HIDDEN for key in outside}
    assert inside.status_code == 200, inside.text
    assert no_right.status_code == 403, no_right.text
    assert _code(hidden_patch) == HIDDEN


@pytest.mark.asyncio
async def test_a_collaborator_sees_its_own_documents_only(
    client_as,
    db_seed,
    tree,  # noqa: F811
    db_session,
):
    ids, collaborator = tree["ids"], tree["collaborator"]
    await db_session.execute(
        update(Document).where(Document.id == ids["own"]).values(status="validated")
    )
    await db_session.commit()
    async with _as(
        client_as, db_seed, tree, "collaborator", "b", collaborator
    ) as client:
        # Same unit, not its own: outside the perimeter.
        colleague = await client.get(f"{DOCUMENTS}/{ids['b']}")
        other_unit = await client.get(f"{DOCUMENTS}/{ids['a']}")
        own = await client.get(f"{DOCUMENTS}/{ids['own']}")
        # Its own document, validated: no longer editable by its owner.
        no_right = await client.patch(
            f"{DOCUMENTS}/{ids['own']}", json={"title": "Renomme"}
        )
    assert _code(colleague) == HIDDEN
    assert _code(other_unit) == HIDDEN
    assert own.status_code == 200, own.text
    assert no_right.status_code == 403, no_right.text


@pytest.mark.asyncio
async def test_a_manager_keeps_its_own_document_moved_to_another_unit(
    client_as,
    db_seed,
    tree,  # noqa: F811
):
    """update_own lets the owner move a draft away and back (undo of a move)."""
    async with _as(
        client_as, db_seed, tree, "manager", "a1", db_seed["user_id"]
    ) as client:
        response = await client.patch(
            f"{DOCUMENTS}/{tree['ids']['b']}", json={"title": "Renomme"}
        )
    assert response.status_code == 200, response.text


async def _restore_and_purge(client, document_id):
    restore = await client.post(f"{DOCUMENTS}/{document_id}/restore")
    purge = await client.delete(f"{DOCUMENTS}/{document_id}/purge")
    return _code(restore), _code(purge)


@pytest.mark.asyncio
async def test_restore_and_purge_never_confirm_a_document_outside_the_tree(
    client_as,
    db_seed,
    tree,  # noqa: F811
):
    """Completes the #202 list for the unit_admin: outside its tree, restore and
    purge answer 404; inside it, purge (no ``documents manage``) answers 403 and
    restore succeeds. The caller is the seeded user: the restore writes an audit
    row."""
    ids = tree["ids"]
    async with _as(
        client_as, db_seed, tree, "unit_admin", "a1", db_seed["user_id"]
    ) as client:
        outside = await _restore_and_purge(client, ids["b_trash"])
        purge_in = await client.delete(f"{DOCUMENTS}/{ids['a1_trash']}/purge")
        restore_in = await client.post(f"{DOCUMENTS}/{ids['a1_trash']}/restore")
    assert outside == (HIDDEN, HIDDEN)
    assert purge_in.status_code == 403, purge_in.text
    assert restore_in.status_code == 200, restore_in.text


@pytest.mark.asyncio
async def test_restore_and_purge_answer_403_inside_the_perimeter_404_outside(
    client_as,
    db_seed,
    tree,  # noqa: F811
):
    """A reader sees its unit's recycle bin but may neither restore nor purge;
    another unit's bin answers like a missing document. A collaborator only
    knows its own documents."""
    ids = tree["ids"]
    async with _as(client_as, db_seed, tree, "reader", "b") as client:
        reader_in = await _restore_and_purge(client, ids["b_trash"])
        reader_out = await _restore_and_purge(client, ids["a1_trash"])
    async with _as(
        client_as, db_seed, tree, "collaborator", "b", tree["collaborator"]
    ) as client:
        collaborator_out = await _restore_and_purge(client, ids["b_trash"])
    assert reader_in == (403, 403)
    assert reader_out == (HIDDEN, HIDDEN)
    assert collaborator_out == (HIDDEN, HIDDEN)
