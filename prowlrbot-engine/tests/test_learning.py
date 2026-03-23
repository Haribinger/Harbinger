from src.memory.learning import LearningEngine, Episode, Strategy


def _ep(id: str, tool: str = "nuclei", target: str = "web_app",
        success: bool = True, fp: bool = False, summary: str = "ok") -> Episode:
    """Helper — build a minimal episode."""
    return Episode(
        id=id, agent="BREACH", mission_id=1, task_title="Scan",
        tool_used=tool, command=tool, target_type=target,
        success=success, result_summary=summary, false_positive=fp,
    )


def test_record_episode():
    eng = LearningEngine()
    eng.record_episode(Episode(
        id="e1", agent="BREACH", mission_id=1, task_title="Scan",
        tool_used="nuclei", command="nuclei -l t.txt",
        target_type="web_app", success=True, result_summary="Found SQLi",
    ))
    assert len(eng._episodes) == 1


def test_tool_effectiveness():
    eng = LearningEngine()
    for i in range(10):
        eng.record_episode(_ep(f"e{i}", success=i < 7))
    stats = eng.get_tool_effectiveness("nuclei", "web_app")
    assert stats["episodes"] == 10
    assert stats["success_rate"] == 0.7


def test_tool_effectiveness_no_data():
    eng = LearningEngine()
    stats = eng.get_tool_effectiveness("dalfox", "web_app")
    assert stats["episodes"] == 0
    assert stats["success_rate"] == 0.0


def test_tool_effectiveness_cross_target_types():
    # Ensure target_type filter narrows results correctly
    eng = LearningEngine()
    for i in range(5):
        eng.record_episode(_ep(f"w{i}", target="web_app", success=True))
    for i in range(5):
        eng.record_episode(_ep(f"a{i}", target="api", success=False))
    web = eng.get_tool_effectiveness("nuclei", "web_app")
    api = eng.get_tool_effectiveness("nuclei", "api")
    assert web["success_rate"] == 1.0
    assert api["success_rate"] == 0.0


def test_false_positive_tracking():
    eng = LearningEngine()
    for i in range(5):
        eng.record_episode(_ep(
            f"fp{i}", success=False,
            summary="info-disclosure on /robots.txt", fp=True,
        ))
    patterns = eng.get_false_positive_patterns(min_count=3)
    assert len(patterns) >= 1
    assert patterns[0]["count"] == 5


def test_false_positive_below_threshold_not_returned():
    eng = LearningEngine()
    eng.record_episode(_ep("fp1", fp=True, summary="rare-pattern"))
    patterns = eng.get_false_positive_patterns(min_count=2)
    pattern_texts = [p["pattern"] for p in patterns]
    # One occurrence should not appear when threshold is 2
    assert not any("rare-pattern" in t for t in pattern_texts)


def test_strategy():
    eng = LearningEngine()
    eng.record_strategy(Strategy(
        id="s1", condition="target uses Cloudflare",
        action="use dalfox for XSS", effectiveness=0.8, sample_size=20,
    ))
    strategies = eng.get_strategies_for("cloudflare")
    assert len(strategies) == 1
    assert strategies[0]["id"] == "s1"


def test_strategy_update():
    # Reinserting the same id should update in-place, not duplicate
    eng = LearningEngine()
    eng.record_strategy(Strategy(id="s1", condition="cloud", action="a", effectiveness=0.5, sample_size=5))
    eng.record_strategy(Strategy(id="s1", condition="cloud", action="a-updated", effectiveness=0.9, sample_size=50))
    assert len(eng._strategies) == 1
    assert eng._strategies[0].effectiveness == 0.9


def test_strategy_no_match():
    eng = LearningEngine()
    eng.record_strategy(Strategy(id="s1", condition="Cloudflare WAF", action="use dalfox", effectiveness=0.8, sample_size=10))
    assert eng.get_strategies_for("akamai") == []


def test_suggest_approach():
    eng = LearningEngine()
    for i in range(15):
        tool = "nuclei" if i < 10 else "dalfox"
        eng.record_episode(_ep(f"e{i}", tool=tool, success=True))
    suggestion = eng.suggest_approach("web_app", "scanning")
    assert suggestion["confidence"] > 0
    assert "nuclei" in suggestion["recommended_tools"]


def test_suggest_approach_no_history():
    eng = LearningEngine()
    result = eng.suggest_approach("mobile", "scanning")
    assert result["confidence"] == 0
    assert "No past experience" in result["suggestion"]


def test_suggest_approach_confidence_caps_at_one():
    eng = LearningEngine()
    # 100 episodes should not push confidence above 1.0
    for i in range(100):
        eng.record_episode(_ep(f"e{i}", success=True))
    suggestion = eng.suggest_approach("web_app", "scan")
    assert suggestion["confidence"] <= 1.0


def test_get_agent_stats():
    eng = LearningEngine()
    for i in range(6):
        eng.record_episode(_ep(f"e{i}", tool="nuclei" if i < 4 else "ffuf", success=i < 4))
    stats = eng.get_agent_stats("BREACH")
    assert stats["episodes"] == 6
    assert 0.0 <= stats["success_rate"] <= 1.0
    assert len(stats["top_tools"]) <= 5


def test_get_agent_stats_no_episodes():
    eng = LearningEngine()
    stats = eng.get_agent_stats("SPECTER")
    assert stats["episodes"] == 0


def test_ring_buffer_caps_at_10000():
    eng = LearningEngine()
    for i in range(10005):
        eng.record_episode(_ep(f"e{i}"))
    assert len(eng._episodes) == 10000
