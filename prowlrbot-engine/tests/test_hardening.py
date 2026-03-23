"""Tests for production hardening: auth guard + rate limiting."""

import time
import pytest
from unittest.mock import patch, MagicMock

import jwt
from starlette.testclient import TestClient

from src.middleware.auth_guard import AuthGuardMiddleware, PUBLIC_MUTATION_PATHS
from src.middleware.rate_limit import SlidingWindowCounter, get_client_ip, RateLimitMiddleware
from src.auth import get_current_user, get_optional_user


# ── Auth dependency tests ────────────────────────────────────────────────────

TEST_SECRET = "test-jwt-secret-for-harbinger"


def make_token(sub: str = "user-1", secret: str = TEST_SECRET, exp_offset: int = 3600) -> str:
    """Create a valid JWT for testing."""
    payload = {"sub": sub, "exp": int(time.time()) + exp_offset}
    return jwt.encode(payload, secret, algorithm="HS256")


class TestGetCurrentUser:
    @pytest.mark.asyncio
    async def test_valid_token(self):
        token = make_token()
        request = MagicMock()
        request.headers = {"Authorization": f"Bearer {token}"}

        with patch("src.auth.get_jwt_secret", return_value=TEST_SECRET):
            user = await get_current_user(request)
            assert user["user_id"] == "user-1"
            assert "claims" in user

    @pytest.mark.asyncio
    async def test_missing_header(self):
        request = MagicMock()
        request.headers = {}

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await get_current_user(request)
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_expired_token(self):
        token = make_token(exp_offset=-100)
        request = MagicMock()
        request.headers = {"Authorization": f"Bearer {token}"}

        from fastapi import HTTPException
        with patch("src.auth.get_jwt_secret", return_value=TEST_SECRET):
            with pytest.raises(HTTPException) as exc:
                await get_current_user(request)
            assert exc.value.status_code == 401
            assert "expired" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_invalid_token(self):
        request = MagicMock()
        request.headers = {"Authorization": "Bearer notavalidjwt"}

        from fastapi import HTTPException
        with patch("src.auth.get_jwt_secret", return_value=TEST_SECRET):
            with pytest.raises(HTTPException) as exc:
                await get_current_user(request)
            assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_wrong_secret(self):
        token = make_token(secret="wrong-secret")
        request = MagicMock()
        request.headers = {"Authorization": f"Bearer {token}"}

        from fastapi import HTTPException
        with patch("src.auth.get_jwt_secret", return_value=TEST_SECRET):
            with pytest.raises(HTTPException) as exc:
                await get_current_user(request)
            assert exc.value.status_code == 401


class TestGetOptionalUser:
    @pytest.mark.asyncio
    async def test_valid_token_returns_user(self):
        token = make_token()
        request = MagicMock()
        request.headers = {"Authorization": f"Bearer {token}"}

        with patch("src.config.settings") as mock_settings:
            mock_settings.jwt_secret = TEST_SECRET
            user = await get_optional_user(request)
            assert user is not None
            assert user["user_id"] == "user-1"

    @pytest.mark.asyncio
    async def test_no_header_returns_none(self):
        request = MagicMock()
        request.headers = {}
        user = await get_optional_user(request)
        assert user is None

    @pytest.mark.asyncio
    async def test_invalid_token_returns_none(self):
        request = MagicMock()
        request.headers = {"Authorization": "Bearer garbage"}

        with patch("src.config.settings") as mock_settings:
            mock_settings.jwt_secret = TEST_SECRET
            user = await get_optional_user(request)
            assert user is None


# ── Sliding window counter tests ─────────────────────────────────────────────


class TestSlidingWindowCounter:
    def test_under_limit(self):
        counter = SlidingWindowCounter(window_seconds=60, max_requests=5)
        for _ in range(5):
            allowed, remaining, retry = counter.is_allowed("ip1")
            assert allowed is True

    def test_over_limit(self):
        counter = SlidingWindowCounter(window_seconds=60, max_requests=3)
        for _ in range(3):
            counter.is_allowed("ip1")

        allowed, remaining, retry = counter.is_allowed("ip1")
        assert allowed is False
        assert remaining == 0
        assert retry > 0

    def test_different_ips_independent(self):
        counter = SlidingWindowCounter(window_seconds=60, max_requests=2)
        counter.is_allowed("ip1")
        counter.is_allowed("ip1")

        # ip1 is at limit
        allowed, _, _ = counter.is_allowed("ip1")
        assert allowed is False

        # ip2 should still be allowed
        allowed, _, _ = counter.is_allowed("ip2")
        assert allowed is True

    def test_window_expiry(self):
        counter = SlidingWindowCounter(window_seconds=1, max_requests=2)
        counter.is_allowed("ip1")
        counter.is_allowed("ip1")

        # At limit
        allowed, _, _ = counter.is_allowed("ip1")
        assert allowed is False

        # Wait for window to expire
        time.sleep(1.1)

        # Should be allowed again
        allowed, _, _ = counter.is_allowed("ip1")
        assert allowed is True

    def test_remaining_count(self):
        counter = SlidingWindowCounter(window_seconds=60, max_requests=5)
        _, remaining, _ = counter.is_allowed("ip1")
        assert remaining == 4

        counter.is_allowed("ip1")
        _, remaining, _ = counter.is_allowed("ip1")
        assert remaining == 2

    def test_cleanup_removes_expired(self):
        counter = SlidingWindowCounter(window_seconds=1, max_requests=100)
        for i in range(10):
            counter.is_allowed(f"ip{i}")

        time.sleep(1.1)
        counter._cleanup(time.time() - 1)
        # All entries should be cleaned up
        total_entries = sum(len(v) for v in counter._requests.values())
        assert total_entries == 0


# ── Auth guard integration constants ─────────────────────────────────────────


class TestAuthGuardConfig:
    def test_public_paths_defined(self):
        assert "/api/v2/health" in PUBLIC_MUTATION_PATHS
        assert "/api/v2/channels/inbound" in PUBLIC_MUTATION_PATHS

    def test_community_submit_is_public(self):
        assert "/api/v2/community/submit" in PUBLIC_MUTATION_PATHS


# ── Client IP extraction ─────────────────────────────────────────────────────


class TestClientIP:
    def test_x_forwarded_for(self):
        request = MagicMock()
        request.headers = {"X-Forwarded-For": "1.2.3.4, 5.6.7.8"}
        request.client = MagicMock(host="127.0.0.1")
        assert get_client_ip(request) == "1.2.3.4"

    def test_direct_client(self):
        request = MagicMock()
        request.headers = {}
        request.client = MagicMock(host="10.0.0.1")
        assert get_client_ip(request) == "10.0.0.1"

    def test_no_client_info(self):
        request = MagicMock()
        request.headers = {}
        request.client = None
        assert get_client_ip(request) == "unknown"
