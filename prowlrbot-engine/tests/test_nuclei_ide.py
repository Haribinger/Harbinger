import os
import time
import jwt
import pytest
from httpx import ASGITransport, AsyncClient
from src.main import create_app

_SECRET = os.environ.get("JWT_SECRET", "test-jwt-secret-for-harbinger-engine")

def _auth_headers():
    token = jwt.encode({"sub": "test", "exp": int(time.time()) + 3600}, _SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
async def client():
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

VALID_TEMPLATE = """id: test-detect
info:
  name: Test Detection
  author: test
  severity: info
  tags: test

http:
  - method: GET
    path:
      - "{{BaseURL}}/"
    matchers:
      - type: word
        words:
          - "test"
"""

@pytest.mark.asyncio
async def test_validate_valid(client):
    resp = await client.post("/api/v2/nuclei-ide/validate", json={"yaml_content": VALID_TEMPLATE}, headers=_auth_headers())
    assert resp.status_code == 200
    assert resp.json()["valid"] is True

@pytest.mark.asyncio
async def test_validate_missing_id(client):
    resp = await client.post("/api/v2/nuclei-ide/validate", json={"yaml_content": "info:\n  name: test"}, headers=_auth_headers())
    assert resp.status_code == 200
    assert resp.json()["valid"] is False

@pytest.mark.asyncio
async def test_create_template(client):
    resp = await client.post("/api/v2/nuclei-ide/templates", json={
        "name": "Test Template",
        "severity": "high",
        "yaml_content": VALID_TEMPLATE,
        "tags": ["test"],
    }, headers=_auth_headers())
    assert resp.status_code == 201
    assert "id" in resp.json()

@pytest.mark.asyncio
async def test_scaffold_http(client):
    resp = await client.get("/api/v2/nuclei-ide/scaffold/http?vuln_type=detect")
    assert resp.status_code == 200
    assert "yaml" in resp.json()
    assert "BaseURL" in resp.json()["yaml"]

@pytest.mark.asyncio
async def test_scaffold_unknown_protocol(client):
    resp = await client.get("/api/v2/nuclei-ide/scaffold/unknown")
    assert resp.status_code == 400

@pytest.mark.asyncio
async def test_stats(client):
    resp = await client.get("/api/v2/nuclei-ide/stats")
    assert resp.status_code == 200
    assert "templates" in resp.json()
