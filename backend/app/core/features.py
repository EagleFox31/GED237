"""Server switches the client reads to hide what is off (#214).

One entry per switch: the key the client reads and the Settings field behind
it. Booleans only and every key always present; a client that does not find a
key reads it as off, so adding a key never breaks an older client. No secret,
URL or internal value goes here.
"""

from app.core.config import settings

FEATURES: dict[str, str] = {
    "recent_tracking": "RECENT_DOCUMENTS_TRACKING_ENABLED",  # #165
    "scheduled_reports": "SCHEDULED_REPORTS_ENABLED",  # #180
    "quality_alerts": "QUALITY_ALERTS_ENABLED",  # #183
    "workflow_inbox": "WORKFLOW_INBOX_ENABLED",  # #153
    "totp": "AUTH_TOTP_ENABLED",  # #193
}

# Settings listed above whose pull request is not merged here yet: their key
# reads false until it lands. Whichever of the two merges second removes the
# line; tests/api/test_config_features.py fails until it does.
NOT_YET_MERGED: dict[str, str] = {
    "RECENT_DOCUMENTS_TRACKING_ENABLED": "#165",
    "SCHEDULED_REPORTS_ENABLED": "#180",
    "QUALITY_ALERTS_ENABLED": "#183",
    "WORKFLOW_INBOX_ENABLED": "#153",
    "AUTH_TOTP_ENABLED": "#193",
}


def feature_flags() -> dict[str, bool]:
    """Current state of every switch; a setting this server lacks is off."""
    return {
        key: bool(getattr(settings, field, False)) for key, field in FEATURES.items()
    }
