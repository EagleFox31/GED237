"""Périmètre effectif des rapports : la règle unique partagée par les routes."""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.services import reports_scope
from app.services.reports_scope import ReportScope, resolve_report_scope

TENANT = uuid4()
OTHER_TENANT = uuid4()
UNIT = uuid4()
OTHER_UNIT = uuid4()


def _user(role: str, org_unit_id=UNIT):
    return SimpleNamespace(
        tenant_id=TENANT, org_unit_id=org_unit_id, role=SimpleNamespace(code=role)
    )


@pytest.fixture
def as_super(monkeypatch):
    """Fixe la réponse de la permission « tenants manage »."""

    def _set(value: bool) -> None:
        async def _can_perform(user, resource, action):
            assert (resource, action) == ("tenants", "manage")
            return value

        monkeypatch.setattr(reports_scope, "can_perform", _can_perform)

    _set(False)
    return _set


async def test_super_admin_may_target_another_tenant(as_super):
    as_super(True)
    scope = await resolve_report_scope(
        _user("superadmin"), tenant_id=OTHER_TENANT, org_unit_id=OTHER_UNIT
    )
    assert scope == ReportScope(OTHER_TENANT, OTHER_UNIT, False)


async def test_super_admin_without_tenant_uses_own(as_super):
    as_super(True)
    scope = await resolve_report_scope(_user("superadmin"), recursive=True)
    assert scope == ReportScope(TENANT, None, True)


async def test_super_admin_with_scoped_role_is_not_restricted(as_super):
    as_super(True)
    scope = await resolve_report_scope(_user("manager"), org_unit_id=OTHER_UNIT)
    assert scope == ReportScope(TENANT, OTHER_UNIT, False)


async def test_non_super_cannot_change_tenant(as_super):
    scope = await resolve_report_scope(_user("admin"), tenant_id=OTHER_TENANT)
    assert scope.tenant_id == TENANT


@pytest.mark.parametrize("recursive", [False, True])
async def test_admin_keeps_requested_unit_and_recursion(as_super, recursive):
    scope = await resolve_report_scope(
        _user("admin"), org_unit_id=OTHER_UNIT, recursive=recursive
    )
    assert scope == ReportScope(TENANT, OTHER_UNIT, recursive)


@pytest.mark.parametrize("role", ["manager", "reader", "MANAGER"])
async def test_scoped_role_without_unit_gets_own_unit_and_children(as_super, role):
    scope = await resolve_report_scope(_user(role))
    assert scope == ReportScope(TENANT, UNIT, True)


@pytest.mark.parametrize("recursive", [False, True])
async def test_scoped_role_on_own_unit_keeps_requested_recursion(as_super, recursive):
    scope = await resolve_report_scope(
        _user("manager"), org_unit_id=UNIT, recursive=recursive
    )
    assert scope == ReportScope(TENANT, UNIT, recursive)


async def test_scoped_role_on_another_unit_is_refused(as_super):
    with pytest.raises(HTTPException) as exc:
        await resolve_report_scope(_user("reader"), org_unit_id=OTHER_UNIT)
    assert exc.value.status_code == 403
    assert exc.value.detail == "Accès hors périmètre organisationnel refusé."


async def test_scoped_role_without_own_unit_is_refused(as_super):
    with pytest.raises(HTTPException) as exc:
        await resolve_report_scope(_user("manager", org_unit_id=None))
    assert exc.value.status_code == 403
    assert exc.value.detail == "Portée organisationnelle invalide."


async def test_user_without_role_is_not_restricted(as_super):
    user = SimpleNamespace(tenant_id=TENANT, org_unit_id=None, role=None)
    scope = await resolve_report_scope(user, org_unit_id=OTHER_UNIT)
    assert scope == ReportScope(TENANT, OTHER_UNIT, False)
