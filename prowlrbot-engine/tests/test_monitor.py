from src.engine.monitor import ExecutionMonitor


def test_monitor_allows_normal_calls():
    mon = ExecutionMonitor(same_tool_limit=5, total_limit=20)
    for _ in range(4):
        assert mon.check("terminal") == "ok"


def test_monitor_detects_same_tool_loop():
    mon = ExecutionMonitor(same_tool_limit=3, total_limit=20)
    mon.check("terminal")
    mon.check("terminal")
    assert mon.check("terminal") == "adviser"


def test_monitor_resets_on_different_tool():
    mon = ExecutionMonitor(same_tool_limit=3, total_limit=20)
    mon.check("terminal")
    mon.check("terminal")
    mon.check("file")
    assert mon.check("terminal") == "ok"


def test_monitor_detects_total_limit():
    mon = ExecutionMonitor(same_tool_limit=100, total_limit=5)
    for i in range(4):
        assert mon.check(f"tool-{i}") == "ok"
    assert mon.check("tool-final") == "abort"
