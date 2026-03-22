"""Registry API — unified configuration for agents, tools, templates, settings."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v2/registry", tags=["registry"])


# === Settings ===

class SettingUpdate(BaseModel):
    value: str | int | float | bool | list | dict

@router.get("/settings")
async def list_settings(prefix: str = ""):
    from src.registry.settings import settings_registry
    return {"settings": settings_registry.get_all_with_metadata(prefix)}

@router.get("/settings/{key:path}")
async def get_setting(key: str):
    from src.registry.settings import settings_registry
    value = settings_registry.get(key)
    if value is None:
        raise HTTPException(404, f"Setting '{key}' not found")
    return {"key": key, "value": value}

@router.put("/settings/{key:path}")
async def update_setting(key: str, body: SettingUpdate):
    from src.registry.settings import settings_registry
    settings_registry.set(key, body.value, source="user", by="api")
    return {"key": key, "value": body.value, "status": "updated"}

@router.delete("/settings/{key:path}")
async def reset_setting(key: str):
    from src.registry.settings import settings_registry
    settings_registry.reset(key)
    return {"key": key, "status": "reset to default"}


# === Agents ===

class AgentUpdate(BaseModel):
    display_name: str | None = None
    description: str | None = None
    tools: list[str] | None = None
    docker_image: str | None = None
    model: str | None = None
    max_iterations: int | None = None
    enabled: bool | None = None

class AgentCreate(BaseModel):
    codename: str
    display_name: str
    description: str
    tools: list[str] = ["terminal", "file", "done"]
    docker_image: str = "harbinger/base:latest"
    model: str | None = None
    max_iterations: int = 100
    tags: list[str] = []

@router.get("/agents")
async def list_agents(enabled_only: bool = False):
    from src.registry.agents import agent_registry
    return {"agents": agent_registry.list_all(enabled_only)}

@router.get("/agents/{codename}")
async def get_agent(codename: str):
    from src.registry.agents import agent_registry
    agent = agent_registry.get(codename)
    if not agent:
        raise HTTPException(404, f"Agent '{codename}' not found")
    return agent.to_dict()

@router.put("/agents/{codename}")
async def update_agent(codename: str, body: AgentUpdate):
    from src.registry.agents import agent_registry
    try:
        updates = {k: v for k, v in body.model_dump().items() if v is not None}
        agent_registry.update(codename, **updates)
        return {"status": "updated", "codename": codename}
    except ValueError as e:
        raise HTTPException(404, str(e))

@router.post("/agents")
async def create_agent(body: AgentCreate):
    from src.registry.agents import AgentDefinition, agent_registry
    try:
        agent = AgentDefinition(
            codename=body.codename.upper(),
            display_name=body.display_name,
            description=body.description,
            tools=body.tools,
            docker_image=body.docker_image,
            model=body.model,
            max_iterations=body.max_iterations,
            tags=body.tags,
            created_by="user",
        )
        agent_registry.register(agent)
        return {"status": "created", "codename": agent.codename}
    except ValueError as e:
        raise HTTPException(409, str(e))

@router.delete("/agents/{codename}")
async def delete_agent(codename: str):
    from src.registry.agents import agent_registry
    try:
        agent_registry.unregister(codename)
        return {"status": "deleted", "codename": codename}
    except ValueError as e:
        raise HTTPException(400, str(e))


# === Templates ===

class TemplateCreate(BaseModel):
    id: str
    name: str
    description: str
    default_autonomy: str = "supervised"
    continuous: bool = False
    scan_interval: int = 3600
    tasks: list[dict] = []

@router.get("/templates")
async def list_templates():
    from src.registry.templates import template_registry
    return {"templates": template_registry.list_all()}

@router.get("/templates/{template_id}")
async def get_template(template_id: str):
    from src.registry.templates import template_registry
    t = template_registry.get(template_id)
    if not t:
        raise HTTPException(404, f"Template '{template_id}' not found")
    return t.to_dict()

@router.post("/templates")
async def create_template(body: TemplateCreate):
    from src.registry.templates import MissionTemplate, template_registry
    template = MissionTemplate(
        id=body.id, name=body.name, description=body.description,
        default_autonomy=body.default_autonomy, continuous=body.continuous,
        scan_interval=body.scan_interval, tasks=body.tasks, created_by="user",
    )
    template_registry.register(template)
    return {"status": "created", "id": template.id}

@router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    from src.registry.templates import template_registry
    try:
        template_registry.unregister(template_id)
        return {"status": "deleted", "id": template_id}
    except ValueError as e:
        raise HTTPException(400, str(e))


# === Overview ===

@router.get("/overview")
async def registry_overview():
    """Full registry overview — everything configurable in one call."""
    from src.registry.settings import settings_registry
    from src.registry.agents import agent_registry
    from src.registry.templates import template_registry
    from src.engine.tools.user_tools import user_tool_registry
    from src.engine.tools.search_engines import SEARCH_TOOL_SCHEMAS

    return {
        "agents": {"total": len(agent_registry.list_all()), "enabled": len(agent_registry.list_all(True))},
        "tools": {
            "builtin": 27,
            "user": len(user_tool_registry.list_all()),
            "search_engines": list(SEARCH_TOOL_SCHEMAS.keys()),
        },
        "templates": {"total": len(template_registry.list_all())},
        "settings": {"total": len(settings_registry.get_all())},
    }
