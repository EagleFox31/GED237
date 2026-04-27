# backend/app/main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import logging
from uuid import uuid4
from app.core.config import settings
from app.api.v1.router import api_router
from app.core.rate_limit import limiter
from app.core.authz.casbin_enforcer import reload_enforcer
from app.core.observability.request_id import set_request_id, reset_request_id

from contextlib import asynccontextmanager
from app.services.notifications.listeners import register_all_listeners
from app.services.gedrules_listeners import register_gedrules_listeners

logger = logging.getLogger(__name__)

# Register listeners globally
register_all_listeners()
register_gedrules_listeners()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("Starting up e-Dossier API...")
    if settings.AUTHZ_BACKEND in {"sql", "shadow"}:
        # Fail fast at boot if SQL authz backend is misconfigured or unavailable.
        await reload_enforcer()
    yield
    # Shutdown actions


app = FastAPI(
    title="E-Dossier Cameroun API",
    description="GED Multi-tenant pour l'Administration Publique Camerounaise",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    token = set_request_id(request_id)
    try:
        response = await call_next(request)
    finally:
        reset_request_id(token)
    response.headers["X-Request-ID"] = request_id
    return response


# Rate Limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "service": "E-Dossier Cameroun API",
    }


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint"""
    return {
        "message": "E-Dossier Cameroun API",
        "docs": "/api/docs",
        "version": "1.0.0",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
