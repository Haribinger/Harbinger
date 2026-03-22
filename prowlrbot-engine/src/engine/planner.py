"""Mission planner — decompose user request into Task DAG using LLM or templates."""
import json
import logging
from typing import Any

from src.agents.config import get_agent_config
from src.engine.templates import get_template, create_tasks_from_template

logger = logging.getLogger(__name__)

PLANNER_PROMPT = """You are the Harbinger mission planner. Decompose this security mission into a task DAG.

Mission: {description}
Target: {target}
Type: {mission_type}

Return a JSON array of tasks. Each task has:
- title: concise task name
- agent: one of PATHFINDER, BREACH, PHANTOM, SPECTER, CIPHER, SAM, SCRIBE, SAGE, MAINTAINER, LENS
- description: what the agent should do
- depends_on: array of task indices (0-based) that must complete first
- approval_required: boolean (true for exploitation, lateral movement, data exfil)

Example for a pentest:
[
  {{"title": "Subdomain Enumeration", "agent": "PATHFINDER", "description": "...", "depends_on": []}},
  {{"title": "Vulnerability Scanning", "agent": "BREACH", "description": "...", "depends_on": [0]}},
  {{"title": "Report", "agent": "SCRIBE", "description": "...", "depends_on": [1]}}
]

Return ONLY the JSON array, no markdown fences."""


async def plan_mission(
    description: str,
    target: str,
    mission_type: str = "custom",
    mission_id: int = 0,
    llm=None,
) -> list[dict]:
    """Plan a mission — use template if available, otherwise LLM."""
    # Try template first
    if mission_type != "custom":
        template_tasks = create_tasks_from_template(mission_type, mission_id)
        if template_tasks:
            logger.info("Using template '%s' for mission %d (%d tasks)", mission_type, mission_id, len(template_tasks))
            return template_tasks

    # Fall back to LLM planning
    if llm is None:
        logger.warning("No LLM available for mission planning, returning empty DAG")
        return []

    prompt = PLANNER_PROMPT.format(description=description, target=target, mission_type=mission_type)

    try:
        response = await llm.call_with_tools(
            [{"role": "user", "content": prompt}],
            tools=None,
        )
        content = response.get("content", "")
        if not content:
            return []

        # Parse JSON from response (strip markdown fences if present)
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]

        raw_tasks = json.loads(content)
        return parse_task_dag(raw_tasks, mission_id, target)

    except (json.JSONDecodeError, KeyError, TypeError) as e:
        logger.error("Failed to parse planner output: %s", e)
        return []


def parse_task_dag(raw: list[dict], mission_id: int, target: str) -> list[dict]:
    """Convert raw planner output into structured task dicts."""
    tasks = []
    for i, t in enumerate(raw):
        tasks.append({
            "mission_id": mission_id,
            "title": t.get("title", f"Task {i}"),
            "description": t.get("description", ""),
            "agent_codename": t.get("agent", "PATHFINDER"),
            "docker_image": get_agent_config(t.get("agent", "PATHFINDER")).get("docker_image", "harbinger/base:latest"),
            "depends_on": t.get("depends_on", []),
            "depends_on_positions": t.get("depends_on", []),
            "approval_required": t.get("approval_required", False),
            "position": i,
            "status": "queued",
            "input": t.get("description", ""),
        })
    return tasks
