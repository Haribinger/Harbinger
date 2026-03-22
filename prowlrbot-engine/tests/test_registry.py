from src.registry.settings import SettingsRegistry
from src.registry.agents import AgentRegistry, AgentDefinition
from src.registry.templates import TemplateRegistry, MissionTemplate

def test_settings_get_default():
    reg = SettingsRegistry()
    assert reg.get("tools.terminal.default_timeout") == 60

def test_settings_override():
    reg = SettingsRegistry()
    reg.set("tools.terminal.default_timeout", 120, source="user")
    assert reg.get("tools.terminal.default_timeout") == 120

def test_settings_reset():
    reg = SettingsRegistry()
    reg.set("tools.terminal.default_timeout", 999)
    reg.reset("tools.terminal.default_timeout")
    assert reg.get("tools.terminal.default_timeout") == 60

def test_settings_prefix_filter():
    reg = SettingsRegistry()
    tools = reg.get_all("tools.terminal")
    assert "tools.terminal.default_timeout" in tools

def test_agent_registry_builtins():
    reg = AgentRegistry()
    assert reg.get("PATHFINDER") is not None
    assert reg.get("BREACH") is not None
    assert len(reg.list_all()) == 12

def test_agent_update():
    reg = AgentRegistry()
    reg.update("PATHFINDER", max_iterations=50, model="ollama/mistral:7b")
    agent = reg.get("PATHFINDER")
    assert agent.max_iterations == 50
    assert agent.model == "ollama/mistral:7b"

def test_agent_custom():
    reg = AgentRegistry()
    reg.register(AgentDefinition(
        codename="CUSTOM_SCANNER",
        display_name="Custom Scanner",
        description="User-defined scanner",
        tools=["terminal", "done"],
        docker_image="my-image:latest",
    ))
    assert reg.get("CUSTOM_SCANNER") is not None
    assert not reg.is_builtin("CUSTOM_SCANNER")

def test_agent_cannot_delete_builtin():
    import pytest
    reg = AgentRegistry()
    with pytest.raises(ValueError):
        reg.unregister("PATHFINDER")

def test_template_registry():
    reg = TemplateRegistry()
    reg.register(MissionTemplate(
        id="my_scan", name="My Scan",
        description="Custom scan template",
        tasks=[{"title": "Scan", "agent": "BREACH"}],
    ))
    assert reg.get("my_scan") is not None
    assert len(reg.list_all()) == 1

def test_template_builtin_protection():
    import pytest
    reg = TemplateRegistry()
    reg.register_builtin(MissionTemplate(id="protected", name="P", description="D"))
    with pytest.raises(ValueError):
        reg.unregister("protected")
