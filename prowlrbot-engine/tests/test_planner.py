import pytest
from src.engine.planner import plan_mission, parse_task_dag

def test_parse_task_dag_from_json():
    raw = [
        {"title": "Recon", "agent": "PATHFINDER", "description": "Enumerate subdomains", "depends_on": []},
        {"title": "Scan", "agent": "BREACH", "description": "Run nuclei", "depends_on": [0]},
        {"title": "Report", "agent": "SCRIBE", "description": "Write report", "depends_on": [1]},
    ]
    tasks = parse_task_dag(raw, mission_id=1, target="example.com")
    assert len(tasks) == 3
    assert tasks[0]["agent_codename"] == "PATHFINDER"
    assert tasks[0]["depends_on"] == []
    assert tasks[1]["depends_on"] == [0]
    assert tasks[2]["position"] == 2

def test_parse_task_dag_with_approval():
    raw = [
        {"title": "Exploit", "agent": "BREACH", "description": "SQLi", "depends_on": [], "approval_required": True},
    ]
    tasks = parse_task_dag(raw, mission_id=1, target="test.com")
    assert tasks[0]["approval_required"] is True

def test_parse_empty_dag():
    tasks = parse_task_dag([], mission_id=1, target="x")
    assert tasks == []


# --- Additional coverage ---

def test_parse_task_dag_mission_id_propagated():
    raw = [
        {"title": "Recon", "agent": "PATHFINDER", "description": "passive recon", "depends_on": []},
    ]
    tasks = parse_task_dag(raw, mission_id=42, target="acme.org")
    assert tasks[0]["mission_id"] == 42

def test_parse_task_dag_status_queued():
    raw = [{"title": "Scan", "agent": "BREACH", "description": "nuclei scan", "depends_on": []}]
    tasks = parse_task_dag(raw, mission_id=5, target="target.io")
    assert tasks[0]["status"] == "queued"

def test_parse_task_dag_docker_image_from_config():
    """Agent docker_image is pulled from AGENT_CONFIG, not hard-coded."""
    from src.agents.config import get_agent_config
    raw = [{"title": "Recon", "agent": "PATHFINDER", "description": "recon", "depends_on": []}]
    tasks = parse_task_dag(raw, mission_id=1, target="x.com")
    expected = get_agent_config("PATHFINDER").get("docker_image", "harbinger/base:latest")
    assert tasks[0]["docker_image"] == expected

def test_parse_task_dag_unknown_agent_defaults():
    """Unknown agent falls back to AGENT_CONFIG default rather than crashing."""
    raw = [{"title": "Mystery", "agent": "UNKNOWN_AGENT", "description": "???", "depends_on": []}]
    tasks = parse_task_dag(raw, mission_id=1, target="x.com")
    # Must not raise; docker_image must be a string
    assert isinstance(tasks[0]["docker_image"], str)

def test_parse_task_dag_input_mirrors_description():
    raw = [{"title": "Fuzz", "agent": "BREACH", "description": "Fuzz endpoints", "depends_on": []}]
    tasks = parse_task_dag(raw, mission_id=1, target="t.com")
    assert tasks[0]["input"] == "Fuzz endpoints"

def test_parse_task_dag_missing_fields_use_defaults():
    """Minimal task dict — only required key is implicit (empty dict is fine)."""
    raw = [{}]
    tasks = parse_task_dag(raw, mission_id=1, target="t.com")
    assert tasks[0]["title"] == "Task 0"
    assert tasks[0]["agent_codename"] == "PATHFINDER"
    assert tasks[0]["depends_on"] == []
    assert tasks[0]["approval_required"] is False

def test_parse_task_dag_multi_depends_on():
    raw = [
        {"title": "A", "agent": "PATHFINDER", "description": "step A", "depends_on": []},
        {"title": "B", "agent": "PATHFINDER", "description": "step B", "depends_on": []},
        {"title": "C", "agent": "BREACH", "description": "step C", "depends_on": [0, 1]},
    ]
    tasks = parse_task_dag(raw, mission_id=1, target="multi.com")
    assert tasks[2]["depends_on"] == [0, 1]
    assert tasks[2]["depends_on_positions"] == [0, 1]


@pytest.mark.asyncio
async def test_plan_mission_no_llm_no_template_returns_empty():
    """Without an LLM and with mission_type='custom', the planner returns []."""
    tasks = await plan_mission(
        description="pentest example.com",
        target="example.com",
        mission_type="custom",
        mission_id=99,
        llm=None,
    )
    assert tasks == []


@pytest.mark.asyncio
async def test_plan_mission_uses_template_when_available():
    """Known template types bypass LLM entirely."""
    tasks = await plan_mission(
        description="run a full pentest",
        target="corp.com",
        mission_type="full_pentest",
        mission_id=10,
        llm=None,  # llm=None proves the template path was taken (no LLM needed)
    )
    assert len(tasks) > 0
    # Template tasks carry agent_codename, not raw 'agent' key
    assert all("agent_codename" in t for t in tasks)


@pytest.mark.asyncio
async def test_plan_mission_llm_bad_json_returns_empty():
    """If the LLM returns garbage, plan_mission returns [] without raising."""
    class BadLLM:
        async def call_with_tools(self, chain, tools=None):
            return {"content": "not valid JSON at all ][{"}

    tasks = await plan_mission(
        description="test bad llm output",
        target="x.com",
        mission_type="custom",
        mission_id=1,
        llm=BadLLM(),
    )
    assert tasks == []


@pytest.mark.asyncio
async def test_plan_mission_llm_empty_content_returns_empty():
    """If the LLM returns empty content, plan_mission returns []."""
    class EmptyLLM:
        async def call_with_tools(self, chain, tools=None):
            return {"content": ""}

    tasks = await plan_mission(
        description="test empty response",
        target="x.com",
        mission_type="custom",
        mission_id=1,
        llm=EmptyLLM(),
    )
    assert tasks == []


@pytest.mark.asyncio
async def test_plan_mission_llm_strips_markdown_fences():
    """LLM output wrapped in ```json fences is parsed correctly."""
    import json as _json

    raw = [{"title": "Recon", "agent": "PATHFINDER", "description": "passive recon", "depends_on": []}]
    fenced = "```json\n" + _json.dumps(raw) + "\n```"

    class FencedLLM:
        async def call_with_tools(self, chain, tools=None):
            return {"content": fenced}

    tasks = await plan_mission(
        description="recon mission",
        target="fence.com",
        mission_type="custom",
        mission_id=1,
        llm=FencedLLM(),
    )
    assert len(tasks) == 1
    assert tasks[0]["agent_codename"] == "PATHFINDER"
