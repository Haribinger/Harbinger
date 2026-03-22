"""Tools API — manage user-addable tools."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.engine.tools.user_tools import UserTool, user_tool_registry

router = APIRouter(prefix="/api/v2/tools", tags=["tools"])


class ToolRegister(BaseModel):
    name: str
    description: str
    command: str
    docker_image: str = "harbinger/base:latest"
    input_schema: dict = {}
    tags: list[str] = []
    timeout: int = 300


@router.get("")
async def list_tools():
    """List all registered tools (built-in + user-added)."""
    from src.engine.tools.search_engines import get_all_search_schemas

    user_tools = user_tool_registry.list_all()
    search_tools = [{"name": k, "type": "search", **v} for k, v in get_all_search_schemas().items()]
    builtin = [
        {"name": "terminal", "type": "environment", "description": "Execute command in agent container"},
        {"name": "file", "type": "environment", "description": "Read/write files in container"},
        {"name": "browser", "type": "search", "description": "Headless browser navigation"},
        {"name": "done", "type": "barrier", "description": "Finish task"},
        {"name": "ask", "type": "barrier", "description": "Ask operator for input"},
    ]
    return {
        "builtin": builtin,
        "search": search_tools,
        "user": user_tools,
        "total": len(builtin) + len(search_tools) + len(user_tools),
    }


@router.post("", status_code=201)
async def register_tool(body: ToolRegister):
    """Register a new user tool."""
    try:
        tool = UserTool(
            name=body.name,
            description=body.description,
            command=body.command,
            docker_image=body.docker_image,
            input_schema=body.input_schema,
            tags=body.tags,
            timeout=body.timeout,
        )
        user_tool_registry.register(tool)
        user_tool_registry.save()
        return tool.to_dict()
    except ValueError as e:
        raise HTTPException(409, str(e))


@router.get("/{name}")
async def get_tool(name: str):
    tool = user_tool_registry.get(name)
    if not tool:
        raise HTTPException(404, f"Tool '{name}' not found")
    return tool.to_dict()


@router.delete("/{name}")
async def delete_tool(name: str):
    if not user_tool_registry.get(name):
        raise HTTPException(404, f"Tool '{name}' not found")
    user_tool_registry.unregister(name)
    user_tool_registry.save()
    return {"status": "deleted", "name": name}


@router.get("/{name}/schema")
async def get_tool_schema(name: str):
    schema = user_tool_registry.get_schema(name)
    if not schema:
        raise HTTPException(404, f"Tool '{name}' not found")
    return schema
