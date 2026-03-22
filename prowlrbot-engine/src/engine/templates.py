"""Mission templates — pre-defined task DAGs for common operations."""

MISSION_TEMPLATES: dict[str, dict] = {
    "full_pentest": {
        "name": "Full Penetration Test",
        "description": "Comprehensive pentest: recon → scan → exploit → post-exploit → report",
        "default_autonomy": "supervised",
        "tasks": [
            {"title": "Passive Reconnaissance", "agent": "SPECTER", "image": "harbinger/osint-tools:latest", "position": 0},
            {"title": "Active Reconnaissance", "agent": "PATHFINDER", "image": "harbinger/pd-tools:latest", "position": 1},
            {"title": "Vulnerability Scanning", "agent": "BREACH", "image": "harbinger/pd-tools:latest", "position": 2, "depends_on_positions": [0, 1]},
            {"title": "Exploitation", "agent": "BREACH", "image": "harbinger/kali-tools:latest", "position": 3, "depends_on_positions": [2], "approval_required": True},
            {"title": "Post-Exploitation", "agent": "BREACH", "image": "harbinger/kali-tools:latest", "position": 4, "depends_on_positions": [3], "approval_required": True},
            {"title": "Report Generation", "agent": "SCRIBE", "image": "harbinger/base:latest", "position": 5, "depends_on_positions": [4]},
        ],
    },
    "bug_bounty": {
        "name": "Bug Bounty Hunt",
        "description": "Automated bug bounty: scope → recon → discover → test → report",
        "default_autonomy": "autonomous",
        "tasks": [
            {"title": "Scope Analysis", "agent": "PATHFINDER", "image": "harbinger/pd-tools:latest", "position": 0},
            {"title": "Subdomain Enumeration", "agent": "PATHFINDER", "image": "harbinger/pd-tools:latest", "position": 1},
            {"title": "Content Discovery", "agent": "PATHFINDER", "image": "harbinger/pd-tools:latest", "position": 2},
            {"title": "Vulnerability Scanning", "agent": "BREACH", "image": "harbinger/pd-tools:latest", "position": 3, "depends_on_positions": [1, 2]},
            {"title": "Manual Verification", "agent": "BREACH", "image": "harbinger/kali-tools:latest", "position": 4, "depends_on_positions": [3], "approval_required": True},
            {"title": "Write Report", "agent": "SCRIBE", "image": "harbinger/base:latest", "position": 5, "depends_on_positions": [4]},
        ],
    },
    "red_team": {
        "name": "Red Team Operation",
        "description": "Full red team: OSINT → access → C2 → lateral → exfil → cleanup",
        "default_autonomy": "manual",
        "tasks": [
            {"title": "OSINT Gathering", "agent": "SPECTER", "image": "harbinger/osint-tools:latest", "position": 0},
            {"title": "Initial Access", "agent": "BREACH", "image": "harbinger/kali-tools:latest", "position": 1, "depends_on_positions": [0], "approval_required": True},
            {"title": "C2 Establishment", "agent": "BREACH", "image": "harbinger/kali-tools:latest", "position": 2, "depends_on_positions": [1], "approval_required": True},
            {"title": "Lateral Movement", "agent": "BREACH", "image": "harbinger/kali-tools:latest", "position": 3, "depends_on_positions": [2], "approval_required": True},
            {"title": "Data Exfiltration", "agent": "BREACH", "image": "harbinger/kali-tools:latest", "position": 4, "depends_on_positions": [3], "approval_required": True},
            {"title": "Cleanup & Report", "agent": "SCRIBE", "image": "harbinger/base:latest", "position": 5, "depends_on_positions": [4]},
        ],
    },
    "code_audit": {
        "name": "Code Security Audit",
        "description": "Static analysis → deps → fix → verify → report",
        "default_autonomy": "autonomous",
        "tasks": [
            {"title": "Static Analysis", "agent": "SAM", "image": "harbinger/dev-tools:latest", "position": 0},
            {"title": "Dependency Audit", "agent": "SAM", "image": "harbinger/dev-tools:latest", "position": 1},
            {"title": "Fix Critical Issues", "agent": "SAM", "image": "harbinger/dev-tools:latest", "position": 2, "depends_on_positions": [0, 1]},
            {"title": "Verify Fixes", "agent": "SAM", "image": "harbinger/dev-tools:latest", "position": 3, "depends_on_positions": [2]},
            {"title": "Generate Report", "agent": "SCRIBE", "image": "harbinger/base:latest", "position": 4, "depends_on_positions": [3]},
        ],
    },
    "continuous_monitor": {
        "name": "Continuous Monitoring",
        "description": "Ongoing: recon → diff → scan new → alert → repeat",
        "default_autonomy": "autonomous",
        "continuous": True,
        "scan_interval": 3600,
        "tasks": [
            {"title": "Periodic Recon", "agent": "PATHFINDER", "image": "harbinger/pd-tools:latest", "position": 0},
            {"title": "Diff Analysis", "agent": "SAGE", "image": "harbinger/base:latest", "position": 1, "depends_on_positions": [0]},
            {"title": "New Target Scanning", "agent": "BREACH", "image": "harbinger/pd-tools:latest", "position": 2, "depends_on_positions": [1]},
        ],
    },
}


def get_template(name: str) -> dict | None:
    return MISSION_TEMPLATES.get(name)


def list_templates() -> list[dict]:
    return [
        {"id": k, "name": v["name"], "description": v["description"],
         "task_count": len(v["tasks"]), "default_autonomy": v.get("default_autonomy", "supervised"),
         "continuous": v.get("continuous", False)}
        for k, v in MISSION_TEMPLATES.items()
    ]


def create_tasks_from_template(template_name: str, mission_id: int) -> list[dict]:
    """Generate task dicts from a template, resolving position-based dependencies to task IDs."""
    template = get_template(template_name)
    if not template:
        return []

    tasks = []
    # First pass: create tasks with positions
    for i, t in enumerate(template["tasks"]):
        tasks.append({
            "mission_id": mission_id,
            "title": t["title"],
            "agent_codename": t["agent"],
            "docker_image": t.get("image", "harbinger/base:latest"),
            "position": t["position"],
            "approval_required": t.get("approval_required", False),
            "depends_on_positions": t.get("depends_on_positions", []),
            "status": "queued",
        })

    return tasks
