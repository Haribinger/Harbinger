import pytest
from unittest.mock import AsyncMock, patch
from src.healing.monitor import SelfHealingMonitor, Diagnosis

def test_diagnosis_auto_fixable():
    d = Diagnosis(reason="OOM killed", root_cause="memory limit", auto_fixable=True, fix_type="oom", suggested_fix="Increase memory", severity="high")
    assert d.auto_fixable
    assert d.fix_type == "oom"

def test_diagnosis_not_fixable():
    d = Diagnosis(reason="Config error", root_cause="missing env", auto_fixable=False, fix_type="manual", suggested_fix="Set ENV var", severity="critical")
    assert not d.auto_fixable

@pytest.mark.asyncio
async def test_monitor_detects_stall():
    monitor = SelfHealingMonitor()
    # Simulate a task with no recent actions (stalled)
    result = monitor.check_stall(last_action_age=150, threshold=120)
    assert result == "stalled"

@pytest.mark.asyncio
async def test_monitor_ok_when_recent():
    monitor = SelfHealingMonitor()
    result = monitor.check_stall(last_action_age=30, threshold=120)
    assert result == "ok"
