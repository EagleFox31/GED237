from fastapi import APIRouter

from app.api.v1.endpoints import (
    analytics,
    audit,
    auth,
    authz,
    categories,
    classification,
    classification_reviews,
    documents,
    gedrules,
    imports,
    notifications,
    org_units,
    reports,
    spaces,
    search,
    tenants,
    usage,
    users,
    workflows,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["Tenants"])
api_router.include_router(
    org_units.router, prefix="/org-units", tags=["Organization Units"]
)
api_router.include_router(spaces.router, prefix="/spaces", tags=["Spaces"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(imports.router, prefix="/imports", tags=["Imports"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["Workflows"])
api_router.include_router(search.router, prefix="/search", tags=["Search"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(
    notifications.router, prefix="/notifications", tags=["Notifications"]
)
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(gedrules.router, prefix="/gedrules", tags=["GEDRules"])
api_router.include_router(
    classification.router,
    prefix="/classification-rules",
    tags=["Classification Rules"],
)
api_router.include_router(
    classification_reviews.router,
    prefix="/classification-reviews",
    tags=["Classification Reviews"],
)
api_router.include_router(authz.router, prefix="/authz", tags=["Authorization"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit"])
api_router.include_router(usage.router, prefix="/usage", tags=["Usage"])
