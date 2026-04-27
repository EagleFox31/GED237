# backend/app/core/authz/__init__.py
from app.core.authz.service import authorize_or_403, can_perform
from app.core.authz.context import AuthzContext, ctx_from_resource

__all__ = ["authorize_or_403", "can_perform", "AuthzContext", "ctx_from_resource"]
