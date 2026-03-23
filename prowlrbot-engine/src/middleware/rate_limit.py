"""
Sliding window rate limiter — per-IP request throttling.

Uses an in-memory dict with cleanup. No external dependencies (no Redis
required). Suitable for single-process deployments. For multi-process,
replace the backing store with Redis.

Default: 100 requests per 60 seconds per IP on /api/v2/* endpoints.
SSE streaming endpoints are excluded (long-lived connections).
"""

import logging
import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Paths exempt from rate limiting (SSE streams, health checks)
EXEMPT_PREFIXES: tuple[str, ...] = (
    "/api/v2/health",
    "/api/v2/warroom",              # SSE streams
    "/api/v2/missions/",            # Contains SSE event streams
    "/docs",
    "/openapi.json",
)

# Match SSE endpoints by suffix
EXEMPT_SUFFIXES: tuple[str, ...] = (
    "/events",
    "/stream",
)


class SlidingWindowCounter:
    """In-memory sliding window counter per key."""

    def __init__(self, window_seconds: int = 60, max_requests: int = 100):
        self.window = window_seconds
        self.max_requests = max_requests
        # key -> list of timestamps
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._last_cleanup = time.time()

    def is_allowed(self, key: str) -> tuple[bool, int, int]:
        """Check if a request is allowed.

        Returns: (allowed, remaining, retry_after_seconds)
        """
        now = time.time()
        cutoff = now - self.window

        # Periodic cleanup to prevent unbounded memory growth
        if now - self._last_cleanup > self.window * 2:
            self._cleanup(cutoff)
            self._last_cleanup = now

        # Remove expired entries for this key
        timestamps = self._requests[key]
        self._requests[key] = [t for t in timestamps if t > cutoff]
        timestamps = self._requests[key]

        count = len(timestamps)
        remaining = max(0, self.max_requests - count)

        if count >= self.max_requests:
            # Calculate retry-after from oldest entry in window
            retry_after = int(timestamps[0] + self.window - now) + 1
            return False, 0, max(retry_after, 1)

        timestamps.append(now)
        return True, remaining - 1, 0

    def _cleanup(self, cutoff: float):
        """Remove expired entries across all keys."""
        empty_keys = []
        for key, timestamps in self._requests.items():
            self._requests[key] = [t for t in timestamps if t > cutoff]
            if not self._requests[key]:
                empty_keys.append(key)
        for key in empty_keys:
            del self._requests[key]


# Singleton counter — shared across all requests
_counter = SlidingWindowCounter(window_seconds=60, max_requests=100)


def get_client_ip(request: Request) -> str:
    """Extract the real client IP, respecting X-Forwarded-For from nginx."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-IP sliding window rate limiter for /api/v2/* endpoints."""

    def __init__(self, app, window: int = 60, max_requests: int = 100):
        super().__init__(app)
        global _counter
        _counter = SlidingWindowCounter(window_seconds=window, max_requests=max_requests)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Only rate-limit v2 API paths
        if not path.startswith("/api/v2"):
            return await call_next(request)

        # Exempt paths
        if path.startswith(EXEMPT_PREFIXES):
            return await call_next(request)
        if any(path.endswith(suffix) for suffix in EXEMPT_SUFFIXES):
            return await call_next(request)

        client_ip = get_client_ip(request)
        allowed, remaining, retry_after = _counter.is_allowed(client_ip)

        if not allowed:
            logger.warning("rate limit exceeded: ip=%s path=%s", client_ip, path)
            return JSONResponse(
                status_code=429,
                content={
                    "ok": False,
                    "error": "Rate limit exceeded",
                    "retry_after": retry_after,
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(_counter.max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time()) + retry_after),
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(_counter.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
