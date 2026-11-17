"""What the server has switched on, for the client to hide the rest (#214)."""

from fastapi import APIRouter, Depends, Response

from app.core.dependencies import get_current_user
from app.core.features import feature_flags

router = APIRouter()


@router.get(
    "/features",
    response_model=dict[str, bool],
    dependencies=[Depends(get_current_user)],
)
async def read_features(response: Response) -> dict[str, bool]:
    """Every switch of app.core.features, on or off. Read once after login.

    Any signed-in user sees every switch, totp included: they say what the
    server offers, nothing about an account.
    """
    # Changes only when the server restarts, but never served stale from a cache.
    response.headers["Cache-Control"] = "no-store"
    return feature_flags()
