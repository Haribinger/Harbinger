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

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request


def get_jwt_secret() -> str:
    # Import here to avoid a circular import at module load time.
    from src.config import settings

    secret = settings.jwt_secret
    if not secret:
        # Fail loudly during request handling — a missing secret is a
        # configuration error, not something we should silently degrade.
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


# Convenience type alias for route signatures:
#   async def my_route(user: CurrentUser): ...
CurrentUser = Annotated[dict, Depends(get_current_user)]
