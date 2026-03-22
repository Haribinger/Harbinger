import pytest


@pytest.mark.asyncio
async def test_health_returns_ok(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("ok", "degraded")
    assert data["service"] == "harbinger-engine"


@pytest.mark.asyncio
async def test_api_v2_health(client):
    resp = await client.get("/api/v2/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["service"] == "harbinger-engine"
