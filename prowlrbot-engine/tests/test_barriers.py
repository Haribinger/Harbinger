"""Tests for the AskUserBarrier system — pause/resume mechanism for operator input."""

import asyncio
import os

import pytest
from httpx import ASGITransport, AsyncClient

# Ensure JWT_SECRET is set before any src imports
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-harbinger-engine")


# ---------------------------------------------------------------------------
# Unit tests — AskUserBarrier class
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ask_and_respond():
    """Barrier pauses, operator responds from another coroutine, correct text returned."""
    from src.engine.ask_barrier import AskUserBarrier

    barrier = AskUserBarrier(timeout=5.0)

    async def responder():
        # Give the ask() coroutine time to register the barrier
        await asyncio.sleep(0.05)
        barrier.respond("subtask-1", "Go ahead")

    asyncio.create_task(responder())
    response = await barrier.ask(
        subtask_id="subtask-1",
        mission_id="mission-abc",
        agent_codename="BREACH",
        question="Should I continue?",
    )
    assert response == "Go ahead"


@pytest.mark.asyncio
async def test_ask_timeout():
    """Barrier with a tiny timeout returns the fallback message without hanging."""
    from src.engine.ask_barrier import AskUserBarrier

    barrier = AskUserBarrier(timeout=0.1)
    response = await barrier.ask(
        subtask_id="subtask-timeout",
        mission_id="mission-x",
        agent_codename="PATHFINDER",
        question="Are you there?",
    )
    assert "No response from operator" in response


@pytest.mark.asyncio
async def test_respond_nonexistent():
    """Responding to an unknown subtask_id returns False cleanly."""
    from src.engine.ask_barrier import AskUserBarrier

    barrier = AskUserBarrier()
    result = barrier.respond("does-not-exist", "hello")
    assert result is False


@pytest.mark.asyncio
async def test_list_pending():
    """Three concurrent pending barriers all appear in list_pending."""
    from src.engine.ask_barrier import AskUserBarrier

    barrier = AskUserBarrier(timeout=5.0)

    # Start three ask() coroutines without awaiting them yet
    tasks = [
        asyncio.create_task(
            barrier.ask(
                subtask_id=f"st-{i}",
                mission_id="m1",
                agent_codename="SPECTER",
                question=f"Question {i}",
            )
        )
        for i in range(3)
    ]

    # Let the event loop run until all three barriers are registered
    await asyncio.sleep(0.05)

    pending = barrier.list_pending()
    assert len(pending) == 3
    ids = {p["subtask_id"] for p in pending}
    assert ids == {"st-0", "st-1", "st-2"}

    # Clean up — resolve all barriers so tasks finish
    for i in range(3):
        barrier.respond(f"st-{i}", "done")

    await asyncio.gather(*tasks)


@pytest.mark.asyncio
async def test_on_ask_callback():
    """Registered callback fires when a barrier is created."""
    from src.engine.ask_barrier import AskUserBarrier

    barrier = AskUserBarrier(timeout=5.0)
    fired: list[str] = []

    async def my_callback(b):
        fired.append(b.subtask_id)

    barrier.on_ask(my_callback)

    async def responder():
        await asyncio.sleep(0.05)
        barrier.respond("cb-subtask", "ok")

    asyncio.create_task(responder())
    await barrier.ask(
        subtask_id="cb-subtask",
        mission_id="m1",
        agent_codename="SAM",
        question="Callback test?",
    )

    assert "cb-subtask" in fired


@pytest.mark.asyncio
async def test_respond_clears_pending():
    """After respond(), the barrier is removed from the pending dict."""
    from src.engine.ask_barrier import AskUserBarrier

    barrier = AskUserBarrier(timeout=5.0)

    task = asyncio.create_task(
        barrier.ask(
            subtask_id="clear-test",
            mission_id="m1",
            agent_codename="CIPHER",
            question="Will you remove me?",
        )
    )

    await asyncio.sleep(0.05)
    assert barrier.get_pending("clear-test") is not None

    barrier.respond("clear-test", "yes")
    await task

    # Should be gone now
    assert barrier.get_pending("clear-test") is None
    assert len(barrier.list_pending()) == 0


# ---------------------------------------------------------------------------
# API tests — /api/v2/barriers/* endpoints
# ---------------------------------------------------------------------------


@pytest.fixture
def app_with_barriers():
    """Create a fresh FastAPI app for barrier API tests."""
    from src.main import create_app

    return create_app()


@pytest.mark.asyncio
async def test_barrier_api_respond(app_with_barriers):
    """POST /api/v2/barriers/{id}/respond resolves a pending barrier."""
    import src.engine.ask_barrier as ask_barrier_module
    from src.engine.ask_barrier import AskUserBarrier

    # Swap in a fresh singleton so tests don't bleed into each other
    fresh_barrier = AskUserBarrier(timeout=5.0)
    original = ask_barrier_module.ask_barrier
    ask_barrier_module.ask_barrier = fresh_barrier

    try:
        task = asyncio.create_task(
            fresh_barrier.ask(
                subtask_id="api-st-1",
                mission_id="m1",
                agent_codename="LENS",
                question="API test question",
            )
        )
        await asyncio.sleep(0.05)

        transport = ASGITransport(app=app_with_barriers)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v2/barriers/api-st-1/respond",
                json={"response": "Operator says yes"},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is True
        assert body["subtask_id"] == "api-st-1"

        result = await task
        assert result == "Operator says yes"
    finally:
        ask_barrier_module.ask_barrier = original


@pytest.mark.asyncio
async def test_barrier_api_list(app_with_barriers):
    """GET /api/v2/barriers/pending returns all pending barriers."""
    import src.engine.ask_barrier as ask_barrier_module
    from src.engine.ask_barrier import AskUserBarrier

    fresh_barrier = AskUserBarrier(timeout=5.0)
    original = ask_barrier_module.ask_barrier
    ask_barrier_module.ask_barrier = fresh_barrier

    try:
        tasks = [
            asyncio.create_task(
                fresh_barrier.ask(
                    subtask_id=f"list-st-{i}",
                    mission_id="m2",
                    agent_codename="SCRIBE",
                    question=f"Pending {i}",
                )
            )
            for i in range(2)
        ]
        await asyncio.sleep(0.05)

        transport = ASGITransport(app=app_with_barriers)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v2/barriers/pending")

        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is True
        assert len(body["items"]) == 2
        ids = {item["subtask_id"] for item in body["items"]}
        assert ids == {"list-st-0", "list-st-1"}

        # Clean up
        for i in range(2):
            fresh_barrier.respond(f"list-st-{i}", "done")
        await asyncio.gather(*tasks)
    finally:
        ask_barrier_module.ask_barrier = original


@pytest.mark.asyncio
async def test_barrier_api_404(app_with_barriers):
    """POST to a nonexistent barrier returns 404."""
    import src.engine.ask_barrier as ask_barrier_module
    from src.engine.ask_barrier import AskUserBarrier

    fresh_barrier = AskUserBarrier(timeout=5.0)
    original = ask_barrier_module.ask_barrier
    ask_barrier_module.ask_barrier = fresh_barrier

    try:
        transport = ASGITransport(app=app_with_barriers)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v2/barriers/no-such-id/respond",
                json={"response": "hello"},
            )

        assert resp.status_code == 404
        assert "no-such-id" in resp.json()["detail"]
    finally:
        ask_barrier_module.ask_barrier = original
