"""Calendar days as users see them (Cameroon) against timestamps stored naive in UTC.

Date filters of the screens (journal Du/Au, document list) take local calendar days,
both bounds inclusive: ``day_from`` starts at local midnight, ``day_to`` ends just
before the next local midnight.
"""

from datetime import date, datetime, time, timedelta, timezone

# Cameroon time (UTC+1, no daylight saving). created_at columns are stored naive in UTC.
LOCAL_TZ = timezone(timedelta(hours=1), "WAT")


def local_midnight_utc(day: date) -> datetime:
    """Local midnight of ``day`` as the naive UTC value stored in created_at columns."""
    local_midnight = datetime.combine(day, time.min, tzinfo=LOCAL_TZ)
    return local_midnight.astimezone(timezone.utc).replace(tzinfo=None)


def local_days_filter(column, day_from: date | None, day_to: date | None) -> list:
    """Conditions keeping ``column`` within the local days, both inclusive."""
    conditions = []
    if day_from:
        conditions.append(column >= local_midnight_utc(day_from))
    if day_to:
        conditions.append(column < local_midnight_utc(day_to + timedelta(days=1)))
    return conditions
