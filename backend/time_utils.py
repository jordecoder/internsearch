from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo


SINGAPORE_TZ = ZoneInfo("Asia/Singapore")


def format_singapore_time(dt: datetime) -> str:
    return dt.astimezone(SINGAPORE_TZ).strftime("%Y-%m-%d %H:%M SGT")
