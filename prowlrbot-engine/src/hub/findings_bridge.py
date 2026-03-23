"""
Findings Bridge — forwards mission results to the Go backend's
/api/findings and /api/vulns endpoints so the frontend pages
(VulnDeepDive, RemediationTracker, FindingsFeed, Dashboard) show real data.

The performer returns results as text. This module parses structured
findings from that text and POSTs them to Go.
"""

import json
import logging
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

GO_BACKEND_URL = "http://backend:8080"


async def bridge_task_result(
    task_id: int,
    mission_id: int,
    agent_codename: str,
    result: dict,
    auth_token: str | None = None,
) -> int:
    """Parse findings from a task result and POST to Go backend.

    Returns the number of findings bridged.
    """
    result_text = result.get("result", "")
    if not result_text or result.get("status") != "done":
        return 0

    findings = _extract_findings(result_text, agent_codename, mission_id, task_id)
    if not findings:
        return 0

    headers = {"Content-Type": "application/json"}
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"

    bridged = 0
    async with httpx.AsyncClient(timeout=10.0) as client:
        for finding in findings:
            try:
                # POST to /api/findings (creates finding entry)
                resp = await client.post(
                    f"{GO_BACKEND_URL}/api/findings",
                    json=finding,
                    headers=headers,
                )
                if resp.status_code in (200, 201):
                    bridged += 1
                    logger.info(
                        "finding bridged: %s (%s) → Go backend",
                        finding.get("title", "untitled"),
                        finding.get("severity", "unknown"),
                    )

                # Also create a vuln entry for high/critical findings
                if finding.get("severity") in ("critical", "high"):
                    vuln = _finding_to_vuln(finding)
                    await client.post(
                        f"{GO_BACKEND_URL}/api/vulns",
                        json=vuln,
                        headers=headers,
                    )
            except Exception as exc:
                logger.warning("failed to bridge finding: %s", exc)

    if bridged:
        logger.info(
            "bridged %d findings from mission %d task %d (%s)",
            bridged, mission_id, task_id, agent_codename,
        )
    return bridged


def _extract_findings(
    result_text: str,
    agent: str,
    mission_id: int,
    task_id: int,
) -> list[dict]:
    """Extract structured findings from agent result text.

    Agents report findings in various formats. We try:
    1. JSON array in the result
    2. Structured text with severity markers
    3. Line-by-line parsing for common patterns
    """
    findings = []

    # Try 1: JSON findings array
    try:
        data = json.loads(result_text)
        if isinstance(data, list):
            for item in data:
                findings.append(_normalize_finding(item, agent, mission_id, task_id))
            return findings
        if isinstance(data, dict) and "findings" in data:
            for item in data["findings"]:
                findings.append(_normalize_finding(item, agent, mission_id, task_id))
            return findings
    except (json.JSONDecodeError, TypeError):
        pass

    # Try 2: Parse nuclei-style output lines
    # Format: [severity] [template-id] [protocol] host
    nuclei_pattern = re.compile(
        r'\[(\w+)\]\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+(.+)'
    )
    for line in result_text.split('\n'):
        m = nuclei_pattern.match(line.strip())
        if m:
            severity, template, protocol, target = m.groups()
            findings.append({
                "title": f"{template} ({protocol})",
                "description": line.strip(),
                "severity": _normalize_severity(severity),
                "type": protocol,
                "target": target.strip(),
                "source": agent,
                "mission_id": mission_id,
                "task_id": task_id,
                "evidence": line.strip(),
                "status": "open",
            })

    # Try 3: Look for common vulnerability markers
    vuln_patterns = [
        (r'(?i)(sql injection|sqli)\s*(?:in|at|on)\s+(\S+)', 'sqli', 'high'),
        (r'(?i)(cross.site scripting|xss)\s*(?:in|at|on)\s+(\S+)', 'xss', 'medium'),
        (r'(?i)(ssrf|server.side request)\s*(?:in|at|on)\s+(\S+)', 'ssrf', 'high'),
        (r'(?i)(rce|remote code execution)\s*(?:in|at|on)\s+(\S+)', 'rce', 'critical'),
        (r'(?i)(idor|insecure direct object)\s*(?:in|at|on)\s+(\S+)', 'idor', 'medium'),
        (r'(?i)(open redirect)\s*(?:in|at|on)\s+(\S+)', 'open_redirect', 'low'),
        (r'(?i)(information disclosure|info leak)\s*(?:in|at|on)\s+(\S+)', 'info_disclosure', 'low'),
    ]
    for pattern, vuln_type, default_severity in vuln_patterns:
        for match in re.finditer(pattern, result_text):
            findings.append({
                "title": f"{match.group(1)} in {match.group(2)}",
                "description": match.group(0),
                "severity": default_severity,
                "type": vuln_type,
                "target": match.group(2),
                "source": agent,
                "mission_id": mission_id,
                "task_id": task_id,
                "evidence": _get_context(result_text, match.start(), 200),
                "status": "open",
            })

    return findings


def _normalize_finding(
    item: dict, agent: str, mission_id: int, task_id: int,
) -> dict:
    """Normalize a finding dict to the Go backend's Finding struct.

    Go requires: title, severity, host, agentCodename, category.
    """
    host = item.get("host", item.get("target", item.get("endpoint", "")))
    # Extract hostname from URL if needed
    if "://" in host:
        from urllib.parse import urlparse
        host = urlparse(host).hostname or host

    return {
        "title": item.get("title", item.get("name", "Untitled finding")),
        "description": item.get("description", item.get("detail", "")),
        "severity": _normalize_severity(item.get("severity", "medium")),
        "category": item.get("type", item.get("category", item.get("vuln_type", "unknown"))),
        "host": host,
        "endpoint": item.get("endpoint", item.get("target", "")),
        "agentCodename": agent,
        "missionId": str(mission_id),
        "taskId": str(task_id),
        "tool": item.get("tool", ""),
        "toolOutput": str(item.get("evidence", item.get("proof", "")))[:4096],
        "confidence": "likely",
        "status": "new",
    }


def _normalize_severity(s: str) -> str:
    s = s.lower().strip()
    mapping = {
        "critical": "critical", "crit": "critical",
        "high": "high", "hi": "high",
        "medium": "medium", "med": "medium", "moderate": "medium",
        "low": "low", "lo": "low",
        "info": "info", "informational": "info",
    }
    return mapping.get(s, "medium")


def _finding_to_vuln(finding: dict) -> dict:
    """Convert a finding to a vulnerability entry for /api/vulns."""
    return {
        "title": finding["title"],
        "description": finding.get("description", ""),
        "severity": finding["severity"],
        "status": "open",
        "target": finding.get("target", ""),
        "type": finding.get("type", ""),
        "evidence": finding.get("evidence", ""),
        "discovered_by": finding.get("source", ""),
        "mission_id": finding.get("mission_id"),
    }


def _get_context(text: str, pos: int, chars: int = 200) -> str:
    """Get surrounding context around a position in text."""
    start = max(0, pos - chars // 2)
    end = min(len(text), pos + chars // 2)
    return text[start:end]
