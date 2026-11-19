"""The new-account e-mail runs in a worker thread (#154): an SMTP server can
block for the whole send timeout, which must not freeze the event loop."""

import threading

import pytest

from app.api.v1.endpoints import users as users_endpoint

USERS = "/api/v1/users"


@pytest.mark.asyncio
async def test_the_account_created_mail_is_sent_off_the_event_loop(
    client_as, db_seed, monkeypatch
):
    calls = []

    def recording_send(**kwargs):
        calls.append((threading.get_ident(), kwargs["to"]))
        return True

    monkeypatch.setattr(users_endpoint, "send_account_created", recording_send)
    loop_thread = threading.get_ident()

    async with client_as("super_admin", tenant_id=db_seed["tenant_id"]) as client:
        response = await client.post(
            f"{USERS}/",
            json={
                "matricule": "MAIL001",
                "email": "mail.agent@testministry.gov.cm",
                "role_id": db_seed["role_id"],
                "tenant_id": str(db_seed["tenant_id"]),
                "org_unit_id": str(db_seed["org_unit_id"]),
            },
        )

    assert response.status_code == 201, response.text
    assert response.json()["generated_password"]
    assert len(calls) == 1
    thread, to = calls[0]
    assert to == "mail.agent@testministry.gov.cm"
    assert thread != loop_thread
