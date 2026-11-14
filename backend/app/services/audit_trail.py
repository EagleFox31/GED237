"""Audit rows for actions that are not tied to a single endpoint helper (login, import)."""

import ipaddress
from typing import Any, Optional
from uuid import UUID

from fastapi import Request

from app.models.audit import AuditLog

USER_AGENT_MAX_LENGTH = 500


def request_origin(request: Optional[Request]) -> dict[str, Optional[str]]:
    """Client IP (only when it is a real address: the column is INET) and user agent."""
    if request is None:
        return {"ip_address": None, "user_agent": None}
    host = request.client.host if request.client else None
    try:
        ip = str(ipaddress.ip_address(host)) if host else None
    except ValueError:
        ip = None
    user_agent = request.headers.get("user-agent")
    return {
        "ip_address": ip,
        "user_agent": user_agent[:USER_AGENT_MAX_LENGTH] if user_agent else None,
    }


def audit_entry(
    *,
    tenant_id: Optional[UUID],
    user_id: Optional[UUID],
    table_name: str,
    record_id: UUID,
    action: str,
    details: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    """One audit row. ``details`` must never carry a secret (password, OTP, token)."""
    return AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        table_name=table_name,
        record_id=record_id,
        action=action,
        new_data=details or {},
        **request_origin(request),
    )
