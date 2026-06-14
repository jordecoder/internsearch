from __future__ import annotations

import logging
import time
from typing import Any

import requests

LOGGER = logging.getLogger(__name__)


class PoliteHttpClient:
    def __init__(
        self,
        *,
        user_agent: str,
        delay_seconds: float = 1.0,
        retries: int = 3,
        timeout_seconds: int = 25,
    ) -> None:
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": user_agent})
        self.delay_seconds = delay_seconds
        self.retries = retries
        self.timeout_seconds = timeout_seconds
        self._last_request_at = 0.0

    def get(self, url: str, **kwargs: Any) -> requests.Response:
        timeout = kwargs.pop("timeout", self.timeout_seconds)
        last_error: Exception | None = None

        for attempt in range(1, self.retries + 1):
            self._respect_rate_limit()
            try:
                response = self.session.get(url, timeout=timeout, **kwargs)
                if response.status_code in {429, 500, 502, 503, 504}:
                    response.raise_for_status()
                return response
            except requests.RequestException as exc:
                last_error = exc
                if attempt == self.retries:
                    break
                sleep_for = min(30, 2**attempt)
                LOGGER.warning(
                    "http_request_retry",
                    extra={"url": url, "attempt": attempt, "sleep_seconds": sleep_for},
                )
                time.sleep(sleep_for)

        assert last_error is not None
        raise last_error

    def _respect_rate_limit(self) -> None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self.delay_seconds:
            time.sleep(self.delay_seconds - elapsed)
        self._last_request_at = time.monotonic()
