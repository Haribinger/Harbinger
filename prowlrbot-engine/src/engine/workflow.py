"""Workflow engine — convert visual DAG workflows into executable Mission→Task pipelines.

Supports node types: agent, tool, condition, approval, handoff.
Converts @xyflow/react graph format to Harbinger's Mission→Task→SubTask hierarchy.
"""
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class WorkflowNode:
    """A node in the workflow graph."""
    id: str
    type: str  # "agent", "tool", "condition", "approval", "handoff", "start", "end"
    label: str = ""
    agent: str = ""  # Agent codename (for agent/tool nodes)
    tool: str = ""  # Tool name (for tool nodes)
    config: dict = field(default_factory=dict)  # Node-specific configuration
    position: dict = field(default_factory=dict)  # UI position {x, y}


@dataclass
class WorkflowEdge:
    """An edge connecting two nodes."""
    id: str
    source: str  # Source node ID
    target: str  # Target node ID
    label: str = ""  # Edge label (for condition branches: "yes", "no")
    condition: str = ""  # Condition expression


@dataclass
class WorkflowDefinition:
    """Complete workflow definition — nodes + edges + metadata."""
    id: str
    name: str
    description: str = ""
    nodes: list[WorkflowNode] = field(default_factory=list)
    edges: list[WorkflowEdge] = field(default_factory=list)
    created_by: str = ""
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "id": self.id, "name": self.name, "description": self.description,
            "nodes": [{"id": n.id, "type": n.type, "label": n.label, "agent": n.agent,
                        "tool": n.tool, "config": n.config} for n in self.nodes],
            "edges": [{"id": e.id, "source": e.source, "target": e.target,
                        "label": e.label, "condition": e.condition} for e in self.edges],
            "created_by": self.created_by,
            "node_count": len(self.nodes),
            "edge_count": len(self.edges),
        }


def parse_workflow(data: dict) -> WorkflowDefinition:
    """Parse a workflow from the frontend react-flow format."""
    nodes = []
    for n in data.get("nodes", []):
        node_data = n.get("data", {})
        nodes.append(WorkflowNode(
            id=n["id"],
            type=node_data.get("type", n.get("type", "agent")),
            label=node_data.get("label", n.get("label", "")),
            agent=node_data.get("agent", ""),
            tool=node_data.get("tool", ""),
            config=node_data.get("config", {}),
            position=n.get("position", {}),
        ))

    edges = []
    for e in data.get("edges", []):
        edges.append(WorkflowEdge(
            id=e.get("id", f"e-{uuid.uuid4().hex[:8]}"),
            source=e["source"],
            target=e["target"],
            label=e.get("label", ""),
            condition=e.get("data", {}).get("condition", ""),
        ))

    return WorkflowDefinition(
        id=data.get("id", f"wf-{uuid.uuid4().hex[:12]}"),
        name=data.get("name", "Untitled Workflow"),
        description=data.get("description", ""),
        nodes=nodes,
        edges=edges,
        created_by=data.get("created_by", ""),
    )


def workflow_to_tasks(workflow: WorkflowDefinition, mission_id: int, target: str = "") -> list[dict]:
    """Convert a workflow DAG into a list of task dicts for the scheduler.

    Maps workflow nodes to tasks:
    - agent node → task with agent_codename
    - tool node → task with agent + specific tool in input
    - approval node → task with approval_required=True
    - condition node → creates branching tasks (simplified: both branches run)
    - handoff node → task that passes context between agents
    - start/end → ignored (structural only)
    """
    node_map = {n.id: n for n in workflow.nodes}

    # Build adjacency list
    children: dict[str, list[str]] = {}
    parents: dict[str, list[str]] = {}
    for edge in workflow.edges:
        children.setdefault(edge.source, []).append(edge.target)
        parents.setdefault(edge.target, []).append(edge.source)

    # Topological sort (Kahn's algorithm)
    in_degree = {n.id: 0 for n in workflow.nodes}
    for edge in workflow.edges:
        in_degree[edge.target] = in_degree.get(edge.target, 0) + 1

    queue = [nid for nid, deg in in_degree.items() if deg == 0]
    order = []
    while queue:
        nid = queue.pop(0)
        order.append(nid)
        for child in children.get(nid, []):
            in_degree[child] -= 1
            if in_degree[child] == 0:
                queue.append(child)

    # Convert ordered nodes to tasks
    tasks = []
    node_to_position: dict[str, int] = {}

    for i, nid in enumerate(order):
        node = node_map.get(nid)
        if not node:
            continue

        # Skip structural nodes
        if node.type in ("start", "end"):
            node_to_position[nid] = -1
            continue

        # Compute dependencies (parent positions), skipping structural nodes
        deps = []
        for parent_id in parents.get(nid, []):
            parent_pos = node_to_position.get(parent_id, -1)
            if parent_pos >= 0:
                deps.append(parent_pos)

        position = len(tasks)
        node_to_position[nid] = position

        if node.type == "agent":
            tasks.append({
                "mission_id": mission_id,
                "title": node.label or f"{node.agent} task",
                "description": node.config.get("description", f"Execute {node.agent} agent task"),
                "agent_codename": node.agent or "PATHFINDER",
                "docker_image": None,
                "depends_on": deps,
                "depends_on_positions": deps,
                "approval_required": False,
                "position": position,
                "status": "queued",
                # Task.input is JSON — wrap the instruction string in a dict
                "input": {"instruction": node.config.get("input", target)},
            })
        elif node.type == "tool":
            tasks.append({
                "mission_id": mission_id,
                "title": node.label or f"Run {node.tool}",
                "description": f"Execute {node.tool}: {node.config.get('command', '')}",
                "agent_codename": node.agent or "PATHFINDER",
                "docker_image": None,
                "depends_on": deps,
                "depends_on_positions": deps,
                "approval_required": False,
                "position": position,
                "status": "queued",
                "input": {
                    "tool": node.tool,
                    "command": node.config.get("command", f"Run {node.tool} on {target}"),
                },
            })
        elif node.type == "approval":
            tasks.append({
                "mission_id": mission_id,
                "title": node.label or "Approval Required",
                "description": node.config.get("message", "Waiting for operator approval"),
                "agent_codename": "ORCHESTRATOR",
                "docker_image": None,
                "depends_on": deps,
                "depends_on_positions": deps,
                "approval_required": True,
                "position": position,
                "status": "queued",
                "input": {"instruction": "Approval gate — operator must approve to continue"},
            })
        elif node.type == "condition":
            # Simplified: condition node becomes a task that evaluates and both branches proceed
            tasks.append({
                "mission_id": mission_id,
                "title": node.label or "Condition Check",
                "description": f"Evaluate: {node.config.get('expression', 'check results')}",
                "agent_codename": "ORCHESTRATOR",
                "docker_image": None,
                "depends_on": deps,
                "depends_on_positions": deps,
                "approval_required": False,
                "position": position,
                "status": "queued",
                "input": {"expression": node.config.get("expression", "")},
            })
        elif node.type == "handoff":
            tasks.append({
                "mission_id": mission_id,
                "title": node.label or f"Handoff to {node.agent}",
                "description": f"Transfer context to {node.agent}",
                "agent_codename": node.agent or "ORCHESTRATOR",
                "docker_image": None,
                "depends_on": deps,
                "depends_on_positions": deps,
                "approval_required": False,
                "position": position,
                "status": "queued",
                "input": {"instruction": "Continue from previous agent's findings"},
            })

    return tasks


# ---------------------------------------------------------------------------
# Workflow store — in-memory, no DB dependency required
# ---------------------------------------------------------------------------

_workflows: dict[str, WorkflowDefinition] = {}


def save_workflow(workflow: WorkflowDefinition) -> None:
    _workflows[workflow.id] = workflow


def get_workflow(workflow_id: str) -> WorkflowDefinition | None:
    return _workflows.get(workflow_id)


def list_workflows() -> list[dict]:
    return [w.to_dict() for w in _workflows.values()]


def delete_workflow(workflow_id: str) -> None:
    _workflows.pop(workflow_id, None)
