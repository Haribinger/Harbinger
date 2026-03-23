import pytest

from src.engine.workflow import parse_workflow, workflow_to_tasks, WorkflowDefinition

SAMPLE_WORKFLOW = {
    "name": "Full Recon",
    "description": "Subdomain enum → HTTP probe → Nuclei scan",
    "nodes": [
        {"id": "n1", "data": {"type": "agent", "label": "Subdomain Enum", "agent": "PATHFINDER", "config": {"input": "enum subdomains"}}},
        {"id": "n2", "data": {"type": "agent", "label": "HTTP Probe", "agent": "PATHFINDER", "config": {"input": "probe live hosts"}}},
        {"id": "n3", "data": {"type": "agent", "label": "Nuclei Scan", "agent": "BREACH", "config": {"input": "run nuclei"}}},
        {"id": "n4", "data": {"type": "approval", "label": "Review Findings", "config": {"message": "Check findings before report"}}},
        {"id": "n5", "data": {"type": "agent", "label": "Write Report", "agent": "SCRIBE", "config": {"input": "generate report"}}},
    ],
    "edges": [
        {"source": "n1", "target": "n2"},
        {"source": "n2", "target": "n3"},
        {"source": "n3", "target": "n4"},
        {"source": "n4", "target": "n5"},
    ],
}


def test_parse_workflow():
    wf = parse_workflow(SAMPLE_WORKFLOW)
    assert wf.name == "Full Recon"
    assert len(wf.nodes) == 5
    assert len(wf.edges) == 4


def test_workflow_to_tasks():
    wf = parse_workflow(SAMPLE_WORKFLOW)
    tasks = workflow_to_tasks(wf, mission_id=1, target="example.com")
    assert len(tasks) == 5
    assert tasks[0]["agent_codename"] == "PATHFINDER"
    assert tasks[2]["agent_codename"] == "BREACH"
    assert tasks[3]["approval_required"] is True
    assert tasks[4]["agent_codename"] == "SCRIBE"


def test_workflow_dependencies():
    wf = parse_workflow(SAMPLE_WORKFLOW)
    tasks = workflow_to_tasks(wf, mission_id=1)
    # n2 depends on n1 (position 0)
    assert tasks[1]["depends_on"] == [0]
    # n3 depends on n2 (position 1)
    assert tasks[2]["depends_on"] == [1]


def test_parallel_branches():
    data = {
        "name": "Parallel",
        "nodes": [
            {"id": "start", "data": {"type": "agent", "label": "Recon", "agent": "PATHFINDER"}},
            {"id": "a", "data": {"type": "agent", "label": "Branch A", "agent": "BREACH"}},
            {"id": "b", "data": {"type": "agent", "label": "Branch B", "agent": "SPECTER"}},
            {"id": "end", "data": {"type": "agent", "label": "Report", "agent": "SCRIBE"}},
        ],
        "edges": [
            {"source": "start", "target": "a"},
            {"source": "start", "target": "b"},
            {"source": "a", "target": "end"},
            {"source": "b", "target": "end"},
        ],
    }
    wf = parse_workflow(data)
    tasks = workflow_to_tasks(wf, mission_id=1)
    assert len(tasks) == 4
    # a and b both depend on start (position 0)
    assert tasks[1]["depends_on"] == [0]
    assert tasks[2]["depends_on"] == [0]
    # end depends on both a and b
    assert set(tasks[3]["depends_on"]) == {1, 2}


def test_empty_workflow():
    wf = parse_workflow({"name": "Empty", "nodes": [], "edges": []})
    tasks = workflow_to_tasks(wf, mission_id=1)
    assert tasks == []


def test_tool_node():
    data = {
        "name": "Tool Test",
        "nodes": [
            {"id": "t1", "data": {"type": "tool", "label": "Run Nuclei", "agent": "BREACH", "tool": "nuclei", "config": {"command": "nuclei -l targets.txt"}}},
        ],
        "edges": [],
    }
    wf = parse_workflow(data)
    tasks = workflow_to_tasks(wf, mission_id=1)
    assert len(tasks) == 1
    # input is a dict; the command string should be present under the "command" key
    assert "nuclei" in tasks[0]["input"]["command"]


def test_workflow_definition_to_dict():
    wf = parse_workflow(SAMPLE_WORKFLOW)
    d = wf.to_dict()
    assert d["name"] == "Full Recon"
    assert d["node_count"] == 5
    assert d["edge_count"] == 4


def test_condition_node():
    data = {
        "name": "Condition Test",
        "nodes": [
            {"id": "c1", "data": {"type": "condition", "label": "Has Vulns?", "config": {"expression": "len(vulns) > 0"}}},
        ],
        "edges": [],
    }
    wf = parse_workflow(data)
    tasks = workflow_to_tasks(wf, mission_id=1)
    assert len(tasks) == 1
    assert tasks[0]["approval_required"] is False
    assert tasks[0]["input"]["expression"] == "len(vulns) > 0"


def test_handoff_node():
    data = {
        "name": "Handoff Test",
        "nodes": [
            {"id": "h1", "data": {"type": "handoff", "label": "Hand to BREACH", "agent": "BREACH"}},
        ],
        "edges": [],
    }
    wf = parse_workflow(data)
    tasks = workflow_to_tasks(wf, mission_id=1)
    assert len(tasks) == 1
    assert tasks[0]["agent_codename"] == "BREACH"


def test_start_end_nodes_skipped():
    """start/end structural nodes must not appear as tasks."""
    data = {
        "name": "Start End",
        "nodes": [
            {"id": "s", "data": {"type": "start", "label": "Start"}},
            {"id": "work", "data": {"type": "agent", "label": "Do Work", "agent": "PATHFINDER"}},
            {"id": "e", "data": {"type": "end", "label": "End"}},
        ],
        "edges": [
            {"source": "s", "target": "work"},
            {"source": "work", "target": "e"},
        ],
    }
    wf = parse_workflow(data)
    tasks = workflow_to_tasks(wf, mission_id=1)
    assert len(tasks) == 1
    assert tasks[0]["agent_codename"] == "PATHFINDER"
    # No dependency on the start node (it was skipped)
    assert tasks[0]["depends_on"] == []
