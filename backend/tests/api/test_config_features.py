"""GET /config/features: the switches the client reads (#214)."""

from types import SimpleNamespace

import pytest

from app.core import features
from app.core.config import Settings
from app.core.features import FEATURES, NOT_YET_MERGED

URL = "/api/v1/config/features"
CONTRACT = [
    "recent_tracking",
    "scheduled_reports",
    "quality_alerts",
    "workflow_inbox",
    "totp",
]


@pytest.mark.asyncio
async def test_an_anonymous_caller_is_refused(async_client):
    response = await async_client.get(URL)
    # FastAPI's HTTPBearer answers 403 when the header is missing (401 from 0.115).
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_an_invalid_token_is_refused(async_client):
    response = await async_client.get(
        URL, headers={"Authorization": "Bearer not-a-token"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_the_contract_every_key_a_boolean_never_cached(
    client_as, db_seed, monkeypatch
):
    monkeypatch.setattr(
        features, "settings", SimpleNamespace(**dict.fromkeys(FEATURES.values(), False))
    )
    async with client_as("reader", tenant_id=db_seed["tenant_id"]) as client:
        response = await client.get(URL)
    assert response.status_code == 200
    body = response.json()
    assert list(body) == CONTRACT
    assert all(value is False for value in body.values())
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
@pytest.mark.parametrize("key, field", list(FEATURES.items()))
@pytest.mark.parametrize("on", [True, False])
async def test_each_key_follows_its_setting(admin_client, monkeypatch, key, field, on):
    others = {name: not on for name in FEATURES.values() if name != field}
    monkeypatch.setattr(features, "settings", SimpleNamespace(**others, **{field: on}))
    body = (await admin_client.get(URL)).json()
    assert body[key] is on
    assert all(body[k] is not on for k in body if k != key)


def test_a_setting_this_server_lacks_reads_off(monkeypatch):
    monkeypatch.setattr(features, "settings", SimpleNamespace())
    assert features.feature_flags() == dict.fromkeys(CONTRACT, False)


def test_each_switch_is_a_setting_or_awaits_its_pull_request():
    # One way only: requiring the line to go once the setting exists would turn
    # red whichever of #224 and the setting's pull request merges second.
    fields = Settings.model_fields
    unknown = [
        field
        for field in FEATURES.values()
        if field not in fields and field not in NOT_YET_MERGED
    ]
    assert not unknown, f"app/core/features.py: unknown setting name {unknown}"
    assert set(NOT_YET_MERGED) <= set(FEATURES.values())
