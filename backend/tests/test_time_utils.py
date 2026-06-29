from datetime import datetime, timezone

from time_utils import format_singapore_time


def test_format_singapore_time_converts_from_utc():
    assert (
        format_singapore_time(datetime(2026, 6, 14, 8, 31, tzinfo=timezone.utc))
        == "2026-06-14 16:31 SGT"
    )
