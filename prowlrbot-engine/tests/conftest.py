import os
import time

# Must be set before src imports so pydantic_settings picks it up.
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-harbinger-engine")

import jwt
import pytest
from fastapi import APIRouter
from httpx import ASGITransport, AsyncClient

from src.auth import CurrentUser
from src.main import create_app

TEST_JWT_SECRET = os.environ["JWT_SECRET"]


# ---------------------------------------------------------------------------
# Test-only router — exposes a protected endpoint used by test_auth.py.
# ---------------------------------------------------------------------------
_test_router = APIRouter()


@_test_router.get("/api/v2/protected-test")
async def protected_test(user: CurrentUser):
    # Return the resolved user identity so tests can assert on it.
    return {"user_id": user["user_id"]}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def app():
    application = create_app()
    application.include_router(_test_router)
    return application


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def make_auth_header(sub: str = "test-user-1") -> dict[str, str]:
    """Create a valid Authorization header for test requests."""
    token = jwt.encode(
        {"sub": sub, "exp": int(time.time()) + 3600},
        TEST_JWT_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Auth headers fixture for tests needing authenticated requests."""
    return make_auth_header()
