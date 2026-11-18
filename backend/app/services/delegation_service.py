"""Create, list and revoke delegations during an absence (DEC-2026-007).

Rules (DEC-2026-007 § 2):
- a manager designates within their own service, a tenant admin within their
  institution; never across institutions;
- the absent agent and the stand-in belong to the same service;
- whoever creates a delegation is neither the absent agent nor the stand-in;
- the stand-in must be able to resolve reviews (``workflows resolve_review``);
- one delegation at a time per absent agent over a given period.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, Request, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.core.authz import can_perform
from app.core.timezone import LOCAL_TZ
from app.models.delegation import Delegation
from app.models.notification import Notification
from app.models.user import User
from app.schemas.delegation import DelegationCreate, DelegationRead, DelegationUser
from app.services.audit_trail import audit_entry

TENANT_WIDE_ROLES = {"tenant_admin"}


def _role_code(user: User) -> str:
    return (getattr(getattr(user, "role", None), "code", "") or "").lower()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def delegation_status(d: Delegation, now: datetime) -> str:
    if d.revoked_at is not None:
        return "revoked"
    if d.starts_at > now:
        return "scheduled"
    if d.ends_at <= now:
        return "ended"
    return "active"


def status_filter(value: str, now: datetime):
    not_revoked = Delegation.revoked_at.is_(None)
    return {
        "revoked": Delegation.revoked_at.is_not(None),
        "scheduled": and_(not_revoked, Delegation.starts_at > now),
        "ended": and_(not_revoked, Delegation.ends_at <= now),
        "active": and_(
            not_revoked, Delegation.starts_at <= now, Delegation.ends_at > now
        ),
    }[value]


def scope_filter(actor: User):
    """Delegations ``actor`` manages: their institution, or their service."""
    clauses = [Delegation.tenant_id == actor.tenant_id]
    if _role_code(actor) not in TENANT_WIDE_ROLES:
        clauses.append(Delegation.org_unit_id == actor.org_unit_id)
    return and_(*clauses)


def to_read(d: Delegation, delegator: User, delegate: User, now: datetime):
    return DelegationRead(
        id=d.id,
        org_unit_id=d.org_unit_id,
        delegator=DelegationUser(id=delegator.id, full_name=delegator.full_name),
        delegate=DelegationUser(id=delegate.id, full_name=delegate.full_name),
        starts_at=d.starts_at,
        ends_at=d.ends_at,
        revoked_at=d.revoked_at,
        created_by=d.created_by,
        created_at=d.created_at,
        status=delegation_status(d, now),
    )


def _snapshot(d: Delegation, delegator: User, delegate: User) -> dict:
    """Readable even after an account is deleted."""
    return {
        "delegator_id": str(delegator.id),
        "delegator_name": delegator.full_name,
        "delegate_id": str(delegate.id),
        "delegate_name": delegate.full_name,
        "starts_at": d.starts_at.isoformat(),
        "ends_at": d.ends_at.isoformat(),
    }


def _notify_delegate(d: Delegation, delegator: User, event_type: str, message: str):
    return Notification(
        user_id=d.delegate_id,
        tenant_id=d.tenant_id,
        event_type=event_type,
        message=message,
        channel="in_app",
        meta_data={
            "delegation_id": str(d.id),
            "on_behalf_of": str(delegator.id),
        },
    )


def _fmt(moment: datetime) -> str:
    """Local (Cameroon) time for a user-facing message; naive values are UTC."""
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(LOCAL_TZ).strftime("%d/%m/%Y %H:%M")


async def _load_user(db: AsyncSession, tenant_id: UUID, user_id: UUID) -> User:
    user = (
        await db.execute(
            select(User)
            .options(selectinload(User.role))
            .where(User.id == user_id, User.tenant_id == tenant_id)
        )
    ).scalar_one_or_none()
    if user is None:
        # Same answer for "absent" and "other institution": nothing leaks.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Agent introuvable")
    return user


def _unprocessable(detail: str) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail)


async def create_delegation(
    db: AsyncSession,
    actor: User,
    payload: DelegationCreate,
    request: Optional[Request] = None,
) -> tuple[DelegationRead, bool]:
    """Return ``(delegation, created)``. A repeated identical request returns the
    existing delegation without writing anything (idempotent)."""
    if payload.delegator_id == payload.delegate_id:
        raise _unprocessable("L'agent absent et l'intérimaire doivent être distincts.")
    delegator = await _load_user(db, actor.tenant_id, payload.delegator_id)
    delegate = await _load_user(db, actor.tenant_id, payload.delegate_id)

    if actor.id in (delegator.id, delegate.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Vous ne pouvez pas créer une délégation qui vous concerne.",
        )
    if _role_code(actor) not in TENANT_WIDE_ROLES and (
        actor.org_unit_id is None or delegator.org_unit_id != actor.org_unit_id
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Agent hors de votre service.")
    if delegator.org_unit_id is None or delegate.org_unit_id != delegator.org_unit_id:
        raise _unprocessable("L'intérimaire doit être du même service.")
    if not delegate.is_active or not await can_perform(
        delegate, "workflows", "resolve_review"
    ):
        raise _unprocessable("Cet agent ne peut pas valider de documents.")

    now = utcnow()
    # An unplanned absence starts now: a start in the past is brought to now.
    starts_at = max(payload.starts_at, now)
    ends_at = payload.ends_at
    if ends_at <= starts_at:
        raise _unprocessable("La fin doit être après le début et dans le futur.")

    # Serialise concurrent creations for the same absent agent.
    await db.execute(select(User.id).where(User.id == delegator.id).with_for_update())
    overlapping = (
        (
            await db.execute(
                select(Delegation).where(
                    Delegation.delegator_id == delegator.id,
                    Delegation.revoked_at.is_(None),
                    Delegation.starts_at < ends_at,
                    Delegation.ends_at > starts_at,
                )
            )
        )
        .scalars()
        .all()
    )
    for existing in overlapping:
        same_start = existing.starts_at == starts_at or (
            payload.starts_at <= now and existing.starts_at <= now
        )
        if (
            existing.delegate_id == delegate.id
            and existing.ends_at == ends_at
            and same_start
        ):
            return to_read(existing, delegator, delegate, now), False
    if overlapping:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Une délégation couvre déjà cet agent sur cette période.",
        )

    delegation = Delegation(
        tenant_id=actor.tenant_id,
        org_unit_id=delegator.org_unit_id,
        delegator_id=delegator.id,
        delegate_id=delegate.id,
        created_by=actor.id,
        starts_at=starts_at,
        ends_at=ends_at,
    )
    db.add(delegation)
    await db.flush()
    db.add(
        audit_entry(
            tenant_id=actor.tenant_id,
            user_id=actor.id,
            table_name="delegations",
            record_id=delegation.id,
            action="delegation_created",
            details=_snapshot(delegation, delegator, delegate),
            request=request,
        )
    )
    db.add(
        _notify_delegate(
            delegation,
            delegator,
            "DELEGATION_GRANTED",
            f"Vous remplacez {delegator.full_name} du {_fmt(starts_at)} "
            f"au {_fmt(ends_at)} : ses validations arrivent dans vos tâches.",
        )
    )
    await db.commit()
    await db.refresh(delegation)
    return to_read(delegation, delegator, delegate, utcnow()), True


async def revoke_delegation(
    db: AsyncSession,
    actor: User,
    delegation_id: UUID,
    request: Optional[Request] = None,
) -> DelegationRead:
    """Revoke at once. Already revoked or ended: no write (idempotent)."""
    delegation = (
        await db.execute(
            select(Delegation)
            .where(Delegation.id == delegation_id, scope_filter(actor))
            .with_for_update()
        )
    ).scalar_one_or_none()
    if delegation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Délégation introuvable")
    delegator = await db.get(User, delegation.delegator_id)
    delegate = await db.get(User, delegation.delegate_id)

    now = utcnow()
    if delegation_status(delegation, now) in ("revoked", "ended"):
        return to_read(delegation, delegator, delegate, now)

    delegation.revoked_at = now
    delegation.revoked_by = actor.id
    db.add(
        audit_entry(
            tenant_id=actor.tenant_id,
            user_id=actor.id,
            table_name="delegations",
            record_id=delegation.id,
            action="delegation_revoked",
            details=_snapshot(delegation, delegator, delegate),
            request=request,
        )
    )
    db.add(
        _notify_delegate(
            delegation,
            delegator,
            "DELEGATION_REVOKED",
            f"Vous ne remplacez plus {delegator.full_name} : "
            "ses validations ne sont plus dans vos tâches.",
        )
    )
    await db.commit()
    await db.refresh(delegation)
    return to_read(delegation, delegator, delegate, now)


async def list_delegations(
    db: AsyncSession,
    where,
) -> list[DelegationRead]:
    Delegator = aliased(User, name="delegator")
    Delegate = aliased(User, name="delegate")
    rows = (
        await db.execute(
            select(Delegation, Delegator, Delegate)
            .join(Delegator, Delegator.id == Delegation.delegator_id)
            .join(Delegate, Delegate.id == Delegation.delegate_id)
            .where(where)
            .order_by(Delegation.starts_at.desc())
        )
    ).all()
    now = utcnow()
    return [to_read(d, delegator, delegate, now) for d, delegator, delegate in rows]


def mine_filter(user: User, now: datetime):
    """Active or upcoming delegations where ``user`` is absent or stands in."""
    return and_(
        Delegation.tenant_id == user.tenant_id,
        or_(Delegation.delegator_id == user.id, Delegation.delegate_id == user.id),
        Delegation.revoked_at.is_(None),
        Delegation.ends_at > now,
    )
