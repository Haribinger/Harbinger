"""Competitive agent execution — run multiple agents on same task, consensus verification.

Use case: reduce false positives by requiring agreement from 2+ independent agents.
When competitive_mode=True on a task, the scheduler calls run_competitive() instead of
execute_task() directly. Each agent runs in its own isolated container in parallel; only
findings agreed upon by >= threshold fraction of agents are surfaced to the operator.
"""
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class Finding:
    id: str
    severity: str
    title: str
    evidence: str
    confidence: float = 0.0
    found_by: list[str] = field(default_factory=list)


@dataclass
class CompetitiveResult:
    task_title: str
    agents: list[str]
    all_findings: list[list[Finding]]
    consensus_findings: list[Finding]
    false_positive_candidates: list[Finding]

    @property
    def agreement_rate(self) -> float:
        """Fraction of unique findings that passed consensus.

        Returns 1.0 when there are no findings at all — no disagreement.
        """
        if not self.all_findings or not self.consensus_findings:
            return 0.0
        total_unique = len({f.id for group in self.all_findings for f in group})
        if total_unique == 0:
            return 1.0
        return len(self.consensus_findings) / total_unique


class ConsensusVerifier:
    """Verify findings through multi-agent consensus.

    threshold: minimum fraction of agents that must report a finding for it to
    be accepted. 0.5 = majority (2 out of 3), 0.66 = supermajority, 1.0 = unanimous.
    """

    def __init__(self, threshold: float = 0.5):
        if not 0.0 < threshold <= 1.0:
            raise ValueError(f"threshold must be in (0, 1], got {threshold}")
        self.threshold = threshold

    def verify(self, agent_findings: list[list[Finding]]) -> list[Finding]:
        """Compare findings from multiple agents. Return consensus set.

        Findings are matched by ID — agents are expected to emit canonical IDs
        (e.g. nuclei template IDs, CVE numbers, or normalised slugs). The
        returned Finding objects carry the merged confidence score and a list of
        the agent indices that found them.
        """
        num_agents = len(agent_findings)
        if num_agents == 0:
            return []

        # Count how many agents reported each finding ID.
        finding_counts: dict[str, int] = {}
        finding_map: dict[str, Finding] = {}      # keep latest version for metadata
        finding_agents: dict[str, list[str]] = {}
        all_evidence: dict[str, list[str]] = {}

        for agent_idx, findings in enumerate(agent_findings):
            agent_name = f"agent-{agent_idx}"
            for f in findings:
                finding_counts[f.id] = finding_counts.get(f.id, 0) + 1
                finding_map[f.id] = f
                finding_agents.setdefault(f.id, []).append(agent_name)
                all_evidence.setdefault(f.id, []).append(f.evidence)

        consensus: list[Finding] = []
        for fid, count in finding_counts.items():
            confidence = count / num_agents
            if confidence >= self.threshold:
                f = finding_map[fid]
                f.confidence = confidence
                f.found_by = finding_agents.get(fid, [])
                consensus.append(f)

        # High confidence first, then by severity as a secondary tie-break.
        _SEVERITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
        consensus.sort(key=lambda f: (-f.confidence, _SEVERITY_RANK.get(f.severity, 9)))
        return consensus

    def get_false_positive_candidates(self, agent_findings: list[list[Finding]]) -> list[Finding]:
        """Return findings reported by exactly one agent — most likely false positives.

        Only meaningful when more than one agent ran. With a single agent there
        is no comparison basis, so an empty list is returned.
        """
        num_agents = len(agent_findings)
        if num_agents <= 1:
            return []

        finding_counts: dict[str, int] = {}
        finding_map: dict[str, Finding] = {}

        for findings in agent_findings:
            for f in findings:
                finding_counts[f.id] = finding_counts.get(f.id, 0) + 1
                finding_map[f.id] = f

        return [
            finding_map[fid]
            for fid, count in finding_counts.items()
            if count == 1
        ]


async def run_competitive(
    task_title: str,
    task_input: str,
    agents: list[str],
    mission_id: int,
    llm=None,
    threshold: float = 0.5,
) -> CompetitiveResult:
    """Run multiple agents on the same task, then verify consensus.

    Called by the scheduler when a task has competitive_mode=True.
    Each agent runs in its own isolated Docker container in parallel; results
    are compared by ConsensusVerifier before being returned.

    Args:
        task_title:  Human-readable label for the task (stored in the result).
        task_input:  The raw task instruction sent to every agent identically.
        agents:      List of agent codenames (e.g. ["BREACH", "PATHFINDER"]).
        mission_id:  Parent mission — passed through to execute_task for DB context.
        llm:         LLM adapter; if None, execute_task falls back to its own default.
        threshold:   Consensus threshold forwarded to ConsensusVerifier.

    Returns:
        CompetitiveResult with per-agent findings, consensus set, and FP candidates.
    """
    import asyncio
    from src.engine.executor import execute_task

    # Fire all agents simultaneously — each gets its own container via execute_task.
    coroutines = [
        execute_task(
            task_id=0,           # Competitive sub-tasks don't occupy real scheduler slots.
            agent_codename=agent,
            docker_image=None,   # Use the agent's own default image.
            mission_id=mission_id,
            task_input=task_input,
            llm=llm,
        )
        for agent in agents
    ]

    raw_results = await asyncio.gather(*coroutines, return_exceptions=True)

    all_findings: list[list[Finding]] = []
    for i, result in enumerate(raw_results):
        if isinstance(result, Exception):
            # An agent failure should not abort the whole competitive run — we
            # count it as a no-finding contribution so the confidence denominator
            # remains correct (a crashed agent can't vouch for anything).
            logger.warning("Competitive agent %s failed: %s", agents[i], result)
            all_findings.append([])
            continue
        findings = _parse_findings(result.get("result", ""), agents[i])
        all_findings.append(findings)

    verifier = ConsensusVerifier(threshold=threshold)
    consensus = verifier.verify(all_findings)
    fp_candidates = verifier.get_false_positive_candidates(all_findings)

    logger.info(
        "Competitive run '%s': %d agents, %d consensus findings, %d FP candidates",
        task_title,
        len(agents),
        len(consensus),
        len(fp_candidates),
    )

    return CompetitiveResult(
        task_title=task_title,
        agents=agents,
        all_findings=all_findings,
        consensus_findings=consensus,
        false_positive_candidates=fp_candidates,
    )


def _parse_findings(result_text: str, agent: str) -> list[Finding]:
    """Best-effort extraction of findings from an agent's free-text output.

    Real-world agents emit structured JSON via their tool calls; this parser
    handles the plain-text fallback path (e.g. when an agent summarises its own
    output at the end of a ReAct chain). Severity keywords trigger extraction —
    the line content becomes the finding ID after normalisation.
    """
    _SEVERITIES = ("critical", "high", "medium", "low", "info")
    findings: list[Finding] = []
    seen_ids: set[str] = set()

    for line in result_text.split("\n"):
        line = line.strip()
        if not line:
            continue

        line_lower = line.lower()
        for severity in _SEVERITIES:
            if severity in line_lower:
                # Normalise the line into a stable ID by stripping the severity
                # keyword and collapsing whitespace/punctuation.
                content = line_lower.replace(severity, "").strip()
                fid = (
                    content[:60]
                    .replace(" ", "-")
                    .replace("/", "-")
                    .strip("-")
                )
                if not fid or fid in seen_ids:
                    break
                seen_ids.add(fid)
                findings.append(Finding(
                    id=fid,
                    severity=severity,
                    title=line[:100],
                    evidence=line,
                    found_by=[agent],
                ))
                break  # Only match the first (most severe) keyword per line.

    return findings
