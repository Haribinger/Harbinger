"""
Auth guard middleware — protects mutation endpoints on /api/v2/*.

All POST, PUT, PATCH, DELETE requests to /api/v2/* require a valid Bearer
JWT unless the path is in the PUBLIC_PATHS whitelist. GET requests are
always allowed (read-only access).

This is applied as Starlette middleware in main.py so it covers every
router without touching individual route files.
"""

import logging

import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Paths that accept anonymous mutations (webhooks, inbound channels, health)
PUBLIC_MUTATION_PATHS: set[str] = {
    "/api/v2/health",
    "/api/v2/channels/inbound",           # External webhook receivers
    "/api/v2/barriers",                    # Agent barrier responses (internal)
    "/api/v2/community/submit",            # Community submissions (open)
}

# Prefixes that are entirely public (no auth for any method)
PUBLIC_PREFIXES: tuple[str, ...] = (
    "/api/v2/health",
    "/api/v2/migration-status",
    "/docs",
    "/openapi.json",
    "/redoc",
)

# HTTP methods that don't modify state — always allowed without auth
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


class AuthGuardMiddleware(BaseHTTPMiddleware):
    """Reject unauthenticated mutations on /api/v2/* endpoints."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method

        # Not a v2 API path — skip (Go backend handles its own auth)
        if not path.startswith("/api/v2"):
            return await call_next(request)

        # Public prefixes — always pass through
        if path.startswith(PUBLIC_PREFIXES):
            return await call_next(request)

        # Safe methods (GET, HEAD, OPTIONS) — always pass through
        if method in SAFE_METHODS:
            return await call_next(request)

        # Public mutation paths — pass through
        for pub_path in PUBLIC_MUTATION_PATHS:
            if path.startswith(pub_path):
                return await call_next(request)

        # Mutation on a protected path — require Bearer JWT
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"ok": False, "error": "Authentication required"},
            )

        token = auth_header[7:]
        try:
            from src.config import settings
            secret = settings.jwt_secret
            if not secret:
                # Auth is not configured — allow in dev, block in prod
                if settings.app_env == "production":
                    return JSONResponse(
                        status_code=503,
                        content={"ok": False, "error": "JWT_SECRET not configured"},
                    )
                # Dev mode: warn but allow
                logger.warning("auth guard: JWT_SECRET empty, allowing request in dev mode")
                return await call_next(request)

            payload = jwt.decode(token, secret, algorithms=["HS256"])
            user_id = payload.get("sub")
            if not user_id:
                return JSONResponse(
                    status_code=401,
                    content={"ok": False, "error": "Invalid token: missing sub"},
                )

            # Stash user in request state for downstream handlers
            request.state.user = {"user_id": user_id, "claims": payload}

        except jwt.ExpiredSignatureError:
            return JSONResponse(
                status_code=401,
                content={"ok": False, "error": "Token expired"},
            )
        except jwt.InvalidTokenError:
            return JSONResponse(
                status_code=401,
                content={"ok": False, "error": "Invalid token"},
            )

        return await call_next(request)
