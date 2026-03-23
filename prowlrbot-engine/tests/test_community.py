import os
import time
import jwt
import pytest

_SECRET = os.environ.get("JWT_SECRET", "test-jwt-secret-for-harbinger-engine")
def _auth():
    token = jwt.encode({"sub": "test", "exp": int(time.time()) + 3600}, _SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_submit_contribution(client):
    resp = await client.post("/api/v2/community/submit", json={
        "title": "My Custom Scanner",
        "description": "A custom vulnerability scanner",
        "type": "tool",
        "author": "testuser",
        "content": {"name": "my-scanner", "description": "Scans stuff", "command": "my-scanner {target}"},
        "tags": ["scanning", "custom"],
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "pending"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_submissions(client):
    resp = await client.get("/api/v2/community/submissions")
    assert resp.status_code == 200
    assert "submissions" in resp.json()


@pytest.mark.asyncio
async def test_review_workflow(client):
    # Submit
    sub = await client.post("/api/v2/community/submit", json={
        "title": "Test Plugin",
        "description": "Test",
        "type": "plugin",
        "author": "reviewer-test",
        "content": {"id": "test-plugin", "name": "Test", "version": "1.0", "author": "test", "description": "test"},
    })
    assert sub.status_code == 201
    sub_id = sub.json()["id"]

    # Review 1 (approve with security check) — still pending, need 2
    r1 = await client.post(f"/api/v2/community/submissions/{sub_id}/review", json={
        "reviewer": "reviewer1",
        "verdict": "approve",
        "comment": "Looks good",
        "security_check": True,
    }, headers=_auth())
    assert r1.status_code == 200
    assert r1.json()["status"] == "pending"

    # Review 2 (approve with security check) — hits auto-approve threshold
    r2 = await client.post(f"/api/v2/community/submissions/{sub_id}/review", json={
        "reviewer": "reviewer2",
        "verdict": "approve",
        "comment": "LGTM",
        "security_check": True,
    }, headers=_auth())
    assert r2.status_code == 200
    assert r2.json()["status"] == "approved"


@pytest.mark.asyncio
async def test_contribution_types(client):
    resp = await client.get("/api/v2/community/types")
    assert resp.status_code == 200
    types = resp.json()["types"]
    assert len(types) == 5
    names = {t["id"] for t in types}
    assert "plugin" in names
    assert "tool" in names


@pytest.mark.asyncio
async def test_stats(client):
    resp = await client.get("/api/v2/community/stats")
    assert resp.status_code == 200
    assert "total_submissions" in resp.json()


@pytest.mark.asyncio
async def test_get_submission(client):
    sub = await client.post("/api/v2/community/submit", json={
        "title": "Get Test",
        "description": "Test get endpoint",
        "type": "template",
        "author": "tester",
        "content": {"id": "t1", "tasks": []},
    })
    sub_id = sub.json()["id"]

    resp = await client.get(f"/api/v2/community/submissions/{sub_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == sub_id
    assert "reviews" in data


@pytest.mark.asyncio
async def test_withdraw_submission(client):
    sub = await client.post("/api/v2/community/submit", json={
        "title": "To Withdraw",
        "description": "Will be withdrawn",
        "type": "tool",
        "author": "tester",
        "content": {"name": "withdraw-me"},
    })
    sub_id = sub.json()["id"]

    resp = await client.delete(f"/api/v2/community/submissions/{sub_id}", headers=_auth())
    assert resp.status_code == 200
    assert resp.json()["status"] == "withdrawn"


@pytest.mark.asyncio
async def test_featured(client):
    resp = await client.get("/api/v2/community/featured")
    assert resp.status_code == 200
    assert "featured" in resp.json()


@pytest.mark.asyncio
async def test_get_submission_not_found(client):
    resp = await client.get("/api/v2/community/submissions/contrib-doesnotexist")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_review_needs_changes(client):
    sub = await client.post("/api/v2/community/submit", json={
        "title": "Needs Work",
        "description": "Incomplete",
        "type": "tool",
        "author": "tester",
        "content": {"name": "wip-tool"},
    })
    sub_id = sub.json()["id"]

    r = await client.post(f"/api/v2/community/submissions/{sub_id}/review", json={
        "reviewer": "picky-reviewer",
        "verdict": "needs_changes",
        "comment": "Missing documentation",
        "security_check": False,
    }, headers=_auth())
    assert r.status_code == 200
    assert r.json()["status"] == "needs_changes"


@pytest.mark.asyncio
async def test_update_submission(client):
    sub = await client.post("/api/v2/community/submit", json={
        "title": "Original Title",
        "description": "Original",
        "type": "tool",
        "author": "tester",
        "content": {"name": "orig-tool"},
    })
    sub_id = sub.json()["id"]

    resp = await client.put(f"/api/v2/community/submissions/{sub_id}", json={
        "title": "Updated Title",
        "description": "Updated description",
        "type": "tool",
        "author": "tester",
        "content": {"name": "orig-tool", "version": "1.1"},
        "tags": ["updated"],
    }, headers=_auth())
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Title"
    assert resp.json()["status"] == "pending"
