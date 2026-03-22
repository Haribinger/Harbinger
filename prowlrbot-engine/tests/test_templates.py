from src.engine.templates import get_template, list_templates, create_tasks_from_template

def test_list_templates():
    templates = list_templates()
    assert len(templates) >= 5
    names = {t["id"] for t in templates}
    assert "full_pentest" in names
    assert "bug_bounty" in names

def test_get_template():
    t = get_template("full_pentest")
    assert t is not None
    assert len(t["tasks"]) == 6
    assert t["tasks"][0]["agent"] == "SPECTER"

def test_create_tasks():
    tasks = create_tasks_from_template("code_audit", mission_id=1)
    assert len(tasks) == 5
    assert tasks[0]["agent_codename"] == "SAM"
    assert tasks[0]["status"] == "queued"

def test_unknown_template():
    assert get_template("nonexistent") is None
    assert create_tasks_from_template("nonexistent", 1) == []
