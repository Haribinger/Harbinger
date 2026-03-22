from src.engine.killswitch import KillSwitch

def test_global_halt():
    ks = KillSwitch()
    assert not ks.is_halted()
    ks.activate_global("test")
    assert ks.is_halted()
    assert ks.global_halt
    ks.deactivate_global()
    assert not ks.is_halted()

def test_mission_halt():
    ks = KillSwitch()
    ks.halt_mission(1, "testing")
    assert ks.is_halted(mission_id=1)
    assert not ks.is_halted(mission_id=2)
    ks.resume_mission(1)
    assert not ks.is_halted(mission_id=1)

def test_agent_halt():
    ks = KillSwitch()
    ks.halt_agent("BREACH", "too aggressive")
    assert ks.is_halted(agent="BREACH")
    assert ks.is_halted(agent="breach")  # case insensitive
    assert not ks.is_halted(agent="PATHFINDER")

def test_events():
    ks = KillSwitch()
    ks.activate_global("e1")
    ks.halt_mission(1, "e2")
    events = ks.get_events()
    assert len(events) == 2

import pytest, asyncio
from src.engine.approval import ApprovalGate

@pytest.mark.asyncio
async def test_approval_approve():
    gate = ApprovalGate()
    async def approve_later():
        await asyncio.sleep(0.05)
        gate.approve(1, "tester")
    asyncio.create_task(approve_later())
    result = await gate.request_approval(1, 1, "BREACH", "Exploit", "SQLi")
    assert result is True

@pytest.mark.asyncio
async def test_approval_deny():
    gate = ApprovalGate()
    async def deny_later():
        await asyncio.sleep(0.05)
        gate.deny(1, "tester")
    asyncio.create_task(deny_later())
    result = await gate.request_approval(1, 1, "BREACH", "Exploit", "SQLi")
    assert result is False

@pytest.mark.asyncio
async def test_approval_timeout():
    gate = ApprovalGate(timeout=0.1)
    result = await gate.request_approval(1, 1, "BREACH", "Exploit", "SQLi")
    assert result is False  # Timed out → denied

def test_pending_list():
    gate = ApprovalGate()
    # Manually add a request (simulating without await)
    from src.engine.approval import ApprovalRequest
    gate._pending[1] = ApprovalRequest(1, 1, "BREACH", "Test", "desc")
    pending = gate.get_pending()
    assert len(pending) == 1
    assert pending[0]["agent"] == "BREACH"
