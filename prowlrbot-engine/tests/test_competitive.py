"""Tests for competitive agent execution and consensus verification.

Covers:
- Unanimous consensus (all agents agree)
- Majority consensus (above threshold)
- No agreement (all findings below threshold)
- CompetitiveResult.agreement_rate property
- False positive candidate extraction
- Edge cases: empty inputs, single agent, threshold validation
"""
import pytest
from src.engine.competitive import ConsensusVerifier, CompetitiveResult, Finding


# ---------------------------------------------------------------------------
# Core consensus tests (from spec)
# ---------------------------------------------------------------------------

def test_consensus_unanimous():
    v = ConsensusVerifier(threshold=0.5)
    findings = [
        [Finding(id="sqli-login", severity="high", title="SQLi in /login", evidence="' OR 1=1")],
        [Finding(id="sqli-login", severity="high", title="SQLi in /login", evidence="1' OR '1'='1")],
    ]
    consensus = v.verify(findings)
    assert len(consensus) == 1
    assert consensus[0].confidence == 1.0


def test_consensus_majority():
    v = ConsensusVerifier(threshold=0.5)
    findings = [
        [
            Finding(id="sqli-login", severity="high", title="SQLi", evidence="a"),
            Finding(id="xss-search", severity="medium", title="XSS", evidence="b"),
        ],
        [Finding(id="sqli-login", severity="high", title="SQLi", evidence="c")],
        [
            Finding(id="sqli-login", severity="high", title="SQLi", evidence="d"),
            Finding(id="lfi-include", severity="high", title="LFI", evidence="e"),
        ],
    ]
    consensus = v.verify(findings)
    # SQLi found by all 3 → confidence 1.0
    # XSS found by 1/3 → confidence 0.33 (below 0.5 threshold)
    # LFI found by 1/3 → confidence 0.33 (below 0.5 threshold)
    assert len(consensus) == 1
    assert consensus[0].id == "sqli-login"


def test_consensus_no_agreement():
    v = ConsensusVerifier(threshold=0.66)
    findings = [
        [Finding(id="a", severity="low", title="A", evidence="1")],
        [Finding(id="b", severity="low", title="B", evidence="2")],
        [Finding(id="c", severity="low", title="C", evidence="3")],
    ]
    consensus = v.verify(findings)
    assert len(consensus) == 0


def test_competitive_result():
    r = CompetitiveResult(
        task_title="Scan example.com",
        agents=["BREACH", "PATHFINDER"],
        all_findings=[[Finding(id="x", severity="high", title="X", evidence="e")]] * 2,
        consensus_findings=[Finding(id="x", severity="high", title="X", evidence="e", confidence=1.0)],
        false_positive_candidates=[],
    )
    assert r.agreement_rate == 1.0
    assert len(r.consensus_findings) == 1


# ---------------------------------------------------------------------------
# ConsensusVerifier additional coverage
# ---------------------------------------------------------------------------

def test_verify_empty_agents():
    v = ConsensusVerifier(threshold=0.5)
    assert v.verify([]) == []


def test_verify_single_agent_above_threshold():
    """A single-agent run at threshold=1.0 means that agent must agree with itself."""
    v = ConsensusVerifier(threshold=1.0)
    findings = [[Finding(id="rce-1", severity="critical", title="RCE", evidence="cmd")]]
    consensus = v.verify(findings)
    assert len(consensus) == 1
    assert consensus[0].confidence == 1.0


def test_verify_confidence_is_fraction_of_agents():
    v = ConsensusVerifier(threshold=0.01)  # Near-zero threshold — accept everything to inspect confidence values.
    findings = [
        [Finding(id="a", severity="high", title="A", evidence="e1")],
        [Finding(id="a", severity="high", title="A", evidence="e2"),
         Finding(id="b", severity="medium", title="B", evidence="e3")],
        [Finding(id="a", severity="high", title="A", evidence="e4")],
    ]
    consensus = v.verify(findings)
    by_id = {f.id: f for f in consensus}
    # "a" found by 3/3 agents
    assert by_id["a"].confidence == pytest.approx(1.0)
    # "b" found by 1/3 agents
    assert by_id["b"].confidence == pytest.approx(1 / 3)


def test_verify_populates_found_by():
    v = ConsensusVerifier(threshold=0.5)
    findings = [
        [Finding(id="sqli", severity="high", title="SQLi", evidence="x")],
        [Finding(id="sqli", severity="high", title="SQLi", evidence="y")],
    ]
    consensus = v.verify(findings)
    assert len(consensus[0].found_by) == 2
    assert "agent-0" in consensus[0].found_by
    assert "agent-1" in consensus[0].found_by


def test_verify_sort_order_confidence_then_severity():
    """Results must be sorted high confidence first, then by severity within same confidence."""
    v = ConsensusVerifier(threshold=0.01)  # Near-zero threshold — accept everything to test sort order.
    findings = [
        [
            Finding(id="low-vuln", severity="low", title="Low", evidence="x"),
            Finding(id="crit-vuln", severity="critical", title="Crit", evidence="y"),
        ],
        [
            Finding(id="crit-vuln", severity="critical", title="Crit", evidence="z"),
        ],
    ]
    consensus = v.verify(findings)
    # crit-vuln has confidence 1.0 (found by both), low-vuln has 0.5 (one agent)
    assert consensus[0].id == "crit-vuln"
    assert consensus[1].id == "low-vuln"


def test_verify_exact_threshold_boundary():
    """A finding at exactly threshold should be included."""
    v = ConsensusVerifier(threshold=0.5)
    findings = [
        [Finding(id="x", severity="medium", title="X", evidence="e")],
        [],
    ]
    consensus = v.verify(findings)
    # 1/2 = 0.5, exactly at threshold — must be included.
    assert len(consensus) == 1
    assert consensus[0].confidence == pytest.approx(0.5)


def test_verify_just_below_threshold_excluded():
    """A finding just below threshold should not appear in consensus."""
    v = ConsensusVerifier(threshold=0.66)
    findings = [
        [Finding(id="x", severity="medium", title="X", evidence="e")],
        [],
        [],
    ]
    consensus = v.verify(findings)
    # 1/3 ≈ 0.33, below 0.66
    assert len(consensus) == 0


# ---------------------------------------------------------------------------
# False positive candidate detection
# ---------------------------------------------------------------------------

def test_false_positive_candidates_single_agent_only():
    v = ConsensusVerifier(threshold=0.5)
    findings = [
        [
            Finding(id="sqli", severity="high", title="SQLi", evidence="a"),
            Finding(id="xss", severity="medium", title="XSS", evidence="b"),
        ],
        [Finding(id="sqli", severity="high", title="SQLi", evidence="c")],
    ]
    fp = v.get_false_positive_candidates(findings)
    assert len(fp) == 1
    assert fp[0].id == "xss"


def test_false_positive_candidates_empty_when_single_agent():
    """With one agent there is no comparison — FP list must be empty."""
    v = ConsensusVerifier(threshold=0.5)
    findings = [[Finding(id="x", severity="high", title="X", evidence="e")]]
    fp = v.get_false_positive_candidates(findings)
    assert fp == []


def test_false_positive_candidates_all_agree():
    v = ConsensusVerifier(threshold=0.5)
    findings = [
        [Finding(id="rce", severity="critical", title="RCE", evidence="e")],
        [Finding(id="rce", severity="critical", title="RCE", evidence="f")],
    ]
    fp = v.get_false_positive_candidates(findings)
    assert fp == []


# ---------------------------------------------------------------------------
# CompetitiveResult.agreement_rate edge cases
# ---------------------------------------------------------------------------

def test_agreement_rate_zero_when_no_consensus():
    r = CompetitiveResult(
        task_title="test",
        agents=["A", "B"],
        all_findings=[
            [Finding(id="x", severity="low", title="X", evidence="e")],
            [Finding(id="y", severity="low", title="Y", evidence="f")],
        ],
        consensus_findings=[],
        false_positive_candidates=[],
    )
    assert r.agreement_rate == 0.0


def test_agreement_rate_zero_when_no_consensus_findings_but_findings_exist():
    """Denominator is total unique IDs, numerator is consensus count."""
    r = CompetitiveResult(
        task_title="test",
        agents=["A"],
        all_findings=[[Finding(id="z", severity="low", title="Z", evidence="e")]],
        consensus_findings=[],
        false_positive_candidates=[],
    )
    assert r.agreement_rate == 0.0


def test_agreement_rate_partial():
    r = CompetitiveResult(
        task_title="test",
        agents=["A", "B"],
        all_findings=[
            [Finding(id="p", severity="high", title="P", evidence="e"),
             Finding(id="q", severity="low", title="Q", evidence="f")],
            [Finding(id="p", severity="high", title="P", evidence="g")],
        ],
        consensus_findings=[Finding(id="p", severity="high", title="P", evidence="e", confidence=1.0)],
        false_positive_candidates=[Finding(id="q", severity="low", title="Q", evidence="f")],
    )
    # 1 consensus out of 2 unique → 0.5
    assert r.agreement_rate == pytest.approx(0.5)


# ---------------------------------------------------------------------------
# Invalid threshold
# ---------------------------------------------------------------------------

def test_invalid_threshold_raises():
    with pytest.raises(ValueError):
        ConsensusVerifier(threshold=0.0)

    with pytest.raises(ValueError):
        ConsensusVerifier(threshold=1.5)
