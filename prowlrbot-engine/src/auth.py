"""
JWT authentication middleware for the Harbinger FastAPI engine.

Validates tokens issued by the Go backend — both sides share JWT_SECRET and
use HS256. This module only VALIDATES tokens; it never issues them.

Token shape (Go backend, backend/cmd/main.go):
    {
        "sub":  "<user-id>",   # user identifier
        "exp":  <unix-ts>,     # standard expiry claim
        ...                    # optional custom claims
    }
"""

import logging
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request

logger = logging.getLogger(__name__)


def get_jwt_secret() -> str:
    # Import here to avoid a circular import at module load time.
    from src.config import settings

    secret = settings.jwt_secret
    if not secret:
        # Warn at startup (module import time callers) so operators see it in
        # logs before the first request arrives, then fail loudly per-request.
        logger.warning(
            "JWT_SECRET is empty — auth is effectively disabled; "
            "all authenticated endpoints will return 503"
        )
        raise HTTPException(
            status_code=503,
            detail="JWT_SECRET not configured — cannot validate tokens",
        )
    return secret


async def get_current_user(request: Request) -> dict:
    """FastAPI dependency that extracts and validates the Bearer JWT.

    Returns a dict with at minimum:
        {"user_id": str, "claims": dict}

    Raises HTTPException(401) for any invalid, missing, or expired token.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    token = auth_header[7:]
    secret = get_jwt_secret()

    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing sub")

    return {"user_id": user_id, "claims": payload}


async def get_optional_user(request: Request) -> dict | None:
    """Like get_current_user but returns None for anonymous requests.

    Use for endpoints that benefit from auth context (audit logging,
    user-scoped results) but should still work for unauthenticated callers.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]
    try:
        from src.config import settings
        secret = settings.jwt_secret
        if not secret:
            return None
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            return None
        return {"user_id": user_id, "claims": payload}
    except (jwt.InvalidTokenError, Exception):
        return None


# Convenience type aliases for route signatures:
#   async def my_route(user: CurrentUser): ...       # 401 if no token
#   async def my_route(user: OptionalUser): ...      # None if no token
CurrentUser = Annotated[dict, Depends(get_current_user)]
OptionalUser = Annotated[dict | None, Depends(get_optional_user)]
