# backend\app\api\v1\endpoints\authz.py
import logging
from typing import List, Literal, Optional

from fastapi import (
    APIRouter,
    Body,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)

from app.core.config import settings
from app.core.rate_limit import limiter, rate_limit_by_user_or_ip
from app.core.dependencies import get_current_user
from app.core.authz.casbin_enforcer import (
    list_sql_policies,
    add_sql_policy,
    remove_sql_policy,
    list_known_roles,
    get_allowed_actions,
    get_allowed_resources,
)
from app.core.authz.metrics import (
    get_authz_metrics_snapshot,
    reset_authz_metrics,
    get_authz_metrics_dropped_count,
    is_authz_metrics_redis_degraded,
)
from app.models.user import User
from app.schemas.authz import (
    PolicyRule,
    PolicyMutationResponse,
    PolicyDeleteResponse,
    AuthzMetricPoint,
    AuthzMetricsResetResponse,
    AuthzMetricsHealthResponse,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _require_super_admin(current_user: User) -> None:
    role_code = (getattr(getattr(current_user, "role", None), "code", "") or "").lower()
    if role_code != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin required.",
        )


async def _require_sql_policy_backend() -> None:
    backend = (settings.AUTHZ_BACKEND or "csv").strip().lower()
    if backend not in {"sql", "shadow"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Authz policy API requires AUTHZ_BACKEND=sql|shadow.",
        )
    try:
        await list_known_roles()
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "[AUTHZ_POLICY_API_UNAVAILABLE] backend=%s error=%s",
            backend,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authz policy API unavailable: SQL policy backend is not ready.",
        ) from exc


def _validate_policy_vocab(policy: PolicyRule) -> None:
    if policy.v1 not in get_allowed_resources():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown resource '{policy.v1}'.",
        )
    if policy.v2 not in get_allowed_actions():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown action '{policy.v2}'.",
        )


def _filter_metrics(
    rows: list[dict],
    *,
    decision: Optional[Literal["allow", "deny"]] = None,
    tenant_id: Optional[str] = None,
    resource: Optional[str] = None,
    action: Optional[str] = None,
) -> list[dict]:
    filtered = rows
    if decision is not None:
        filtered = [item for item in filtered if item["decision"] == decision]
    if tenant_id is not None:
        filtered = [item for item in filtered if item["tenant_id"] == tenant_id]
    if resource is not None:
        filtered = [item for item in filtered if item["resource"] == resource]
    if action is not None:
        filtered = [item for item in filtered if item["action"] == action]
    filtered.sort(key=lambda item: item["count"], reverse=True)
    return filtered


def _parse_policy_payload(payload: object) -> PolicyRule:
    if isinstance(payload, list):
        if len(payload) > 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bulk mutation > 5 policies is blocked.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bulk policy mutation is not supported on this endpoint.",
        )
    try:
        return PolicyRule.model_validate(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid policy payload.",
        ) from exc


@router.get("/policies", response_model=List[PolicyRule])
async def get_policies(
    current_user: User = Depends(get_current_user),
):
    _require_super_admin(current_user)
    await _require_sql_policy_backend()
    rows = await list_sql_policies()
    return [PolicyRule(**row) for row in rows]


@router.post(
    "/policies",
    response_model=PolicyMutationResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute", key_func=rate_limit_by_user_or_ip)
async def add_policy(
    request: Request,
    response: Response,
    payload: object = Body(...),
    current_user: User = Depends(get_current_user),
):
    policy = _parse_policy_payload(payload)
    _require_super_admin(current_user)
    await _require_sql_policy_backend()
    _validate_policy_vocab(policy)

    created = await add_sql_policy(
        [policy.v0, policy.v1, policy.v2, policy.v3, policy.v4, policy.v5]
    )
    if not created:
        response.status_code = status.HTTP_200_OK
        return PolicyMutationResponse(created=False, policy=policy)

    logger.warning(
        "[AUTHZ_POLICY_MUTATION] op=add created=%s actor_id=%s actor_role=%s ptype=%s v0=%s v1=%s v2=%s v3=%s v4=%s v5=%s",
        created,
        str(current_user.id),
        current_user.role.code,
        policy.ptype,
        policy.v0,
        policy.v1,
        policy.v2,
        policy.v3,
        policy.v4,
        policy.v5,
    )
    return PolicyMutationResponse(created=True, policy=policy)


@router.delete("/policies", response_model=PolicyDeleteResponse)
@limiter.limit("10/minute", key_func=rate_limit_by_user_or_ip)
async def delete_policy(
    request: Request,
    payload: object = Body(...),
    current_user: User = Depends(get_current_user),
):
    policy = _parse_policy_payload(payload)
    _require_super_admin(current_user)
    await _require_sql_policy_backend()
    _validate_policy_vocab(policy)

    deleted = await remove_sql_policy(
        [policy.v0, policy.v1, policy.v2, policy.v3, policy.v4, policy.v5]
    )
    logger.warning(
        "[AUTHZ_POLICY_MUTATION] op=delete deleted=%s actor_id=%s actor_role=%s ptype=%s v0=%s v1=%s v2=%s v3=%s v4=%s v5=%s",
        deleted,
        str(current_user.id),
        current_user.role.code,
        policy.ptype,
        policy.v0,
        policy.v1,
        policy.v2,
        policy.v3,
        policy.v4,
        policy.v5,
    )
    return PolicyDeleteResponse(deleted=deleted, policy=policy)


@router.get("/roles", response_model=List[str])
async def get_roles(
    current_user: User = Depends(get_current_user),
):
    _require_super_admin(current_user)
    await _require_sql_policy_backend()
    return await list_known_roles()


@router.get("/metrics", response_model=List[AuthzMetricPoint])
async def get_authz_metrics(
    decision: Optional[Literal["allow", "deny"]] = Query(default=None),
    tenant_id: Optional[str] = Query(default=None),
    resource: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    top_n: int = Query(default=100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
):
    _require_super_admin(current_user)
    rows = _filter_metrics(
        get_authz_metrics_snapshot(),
        decision=decision,
        tenant_id=tenant_id,
        resource=resource,
        action=action,
    )
    return [AuthzMetricPoint(**row) for row in rows[:top_n]]


@router.get("/metrics/top-denies", response_model=List[AuthzMetricPoint])
async def get_authz_top_denies(
    tenant_id: Optional[str] = Query(default=None),
    resource: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    top_n: int = Query(default=20, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
):
    _require_super_admin(current_user)
    rows = _filter_metrics(
        get_authz_metrics_snapshot(),
        decision="deny",
        tenant_id=tenant_id,
        resource=resource,
        action=action,
    )
    return [AuthzMetricPoint(**row) for row in rows[:top_n]]


@router.post("/metrics/reset", response_model=AuthzMetricsResetResponse)
async def reset_metrics(
    current_user: User = Depends(get_current_user),
):
    _require_super_admin(current_user)
    reset_authz_metrics()
    return AuthzMetricsResetResponse(reset=True)


@router.get("/metrics/health", response_model=AuthzMetricsHealthResponse)
async def get_authz_metrics_health(
    current_user: User = Depends(get_current_user),
):
    """
    Observed health state for authz metrics backend.
    `degraded` reflects last-known Redis failures observed by metrics operations,
    not an active live probe.
    """
    _require_super_admin(current_user)
    return AuthzMetricsHealthResponse(
        backend=settings.AUTHZ_METRICS_BACKEND,
        dropped_count=get_authz_metrics_dropped_count(),
        degraded=is_authz_metrics_redis_degraded(),
    )
