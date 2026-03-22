import os

os.environ["JWT_SECRET"] = "test-jwt-secret-for-harbinger-engine"

import jwt
import pytest
from datetime import datetime, timedelta, timezone

TEST_SECRET = "test-jwt-secret-for-harbinger-engine"


def make_token(payload, secret=TEST_SECRET):
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.mark.asyncio
async def test_protected_route_rejects_no_token(client):
    resp = await client.get("/api/v2/protected-test")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_accepts_valid_token(client):
    token = make_token({
        "sub": "user-123",
        "exp": (datetime.now(timezone.utc) + timedelta(hours=1)).timestamp(),
    })
    resp = await client.get(
        "/api/v2/protected-test",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["user_id"] == "user-123"


@pytest.mark.asyncio
async def test_protected_route_rejects_expired_token(client):
    token = make_token({
        "sub": "user-123",
        "exp": (datetime.now(timezone.utc) - timedelta(hours=1)).timestamp(),
    })
    resp = await client.get(
        "/api/v2/protected-test",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 401
