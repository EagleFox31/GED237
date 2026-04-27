# backend/app/api/v1/router.py
from fastapi import APIRouter
from app.api.v1.endpoints import auth

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

from app.api.v1.endpoints import tenants

api_router.include_router(tenants.router, prefix="/tenants", tags=["Tenants"])

from app.api.v1.endpoints import org_units, users

api_router.include_router(
    org_units.router, prefix="/org-units", tags=["Organization Units"]
)
api_router.include_router(users.router, prefix="/users", tags=["Users"])
from app.api.v1.endpoints import documents, workflows

api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["Workflows"])
from app.api.v1.endpoints import search, notifications, analytics, gedrules, categories

api_router.include_router(search.router, prefix="/search", tags=["Search"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(
    notifications.router, prefix="/notifications", tags=["Notifications"]
)
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(gedrules.router, prefix="/gedrules", tags=["GEDRules"])
from app.api.v1.endpoints import authz

api_router.include_router(authz.router, prefix="/authz", tags=["Authorization"])
from app.api.v1.endpoints import audit

api_router.include_router(audit.router, prefix="/audit", tags=["Audit"])
