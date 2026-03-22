import pytest
from src.engine.tools.user_tools import UserToolRegistry, UserTool


def test_register_tool():
    reg = UserToolRegistry()
    reg.register(UserTool(
        name="my-scanner",
        description="Custom vuln scanner",
        command="my-scanner --target {target} --output json",
        docker_image="harbinger/dev-tools:latest",
        input_schema={"target": {"type": "string"}},
    ))
    assert reg.get("my-scanner") is not None
    assert reg.get("my-scanner").name == "my-scanner"


def test_list_tools():
    reg = UserToolRegistry()
    reg.register(UserTool(name="tool-a", description="A", command="a"))
    reg.register(UserTool(name="tool-b", description="B", command="b"))
    tools = reg.list_all()
    assert len(tools) == 2


def test_unregister():
    reg = UserToolRegistry()
    reg.register(UserTool(name="temp", description="Temp", command="temp"))
    reg.unregister("temp")
    assert reg.get("temp") is None


def test_schema_generation():
    reg = UserToolRegistry()
    reg.register(UserTool(
        name="nmap-scan",
        description="Run nmap",
        command="nmap {flags} {target}",
        input_schema={"target": {"type": "string"}, "flags": {"type": "string", "default": "-sV"}},
    ))
    schema = reg.get_schema("nmap-scan")
    assert schema["name"] == "nmap-scan"
    assert "target" in schema["parameters"]["properties"]


def test_duplicate_rejects():
    reg = UserToolRegistry()
    reg.register(UserTool(name="x", description="X", command="x"))
    with pytest.raises(ValueError):
        reg.register(UserTool(name="x", description="X2", command="x2"))


def test_tool_to_dict():
    tool = UserTool(name="test", description="Test tool", command="test {arg}",
                     docker_image="harbinger/base:latest",
                     input_schema={"arg": {"type": "string"}},
                     tags=["recon", "custom"])
    d = tool.to_dict()
    assert d["name"] == "test"
    assert d["tags"] == ["recon", "custom"]
    assert d["docker_image"] == "harbinger/base:latest"
