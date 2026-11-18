"""Local time shown to users.

Cameroon time (WAT, UTC+1, no daylight saving). Timestamps are stored in UTC;
convert with ``LOCAL_TZ`` only when displaying a date or reading a calendar day.
"""

from datetime import timedelta, timezone

LOCAL_TZ = timezone(timedelta(hours=1), "WAT")
