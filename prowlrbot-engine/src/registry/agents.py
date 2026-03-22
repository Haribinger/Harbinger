"""Agent registry — user-configurable agent definitions.

Replaces the hardcoded AGENT_CONFIG dict. Users can:
- Change which tools an agent has access to
- Change the Docker image
- Change the LLM model per agent
- Change iteration limits
- Add entirely new agent types
"""
import logging
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class AgentDefinition:
    codename: str
    display_name: str
    description: str
    tools: list[str]
    docker_image: str | None = None
    model: str | None = None
    max_iterations: int = 100
    prompt_template: str = ""  # Path to prompt file or inline text
    tags: list[str] = field(default_factory=list)
    enabled: bool = True
    created_by: str = "system"
    updated_at: float = 0

    def to_dict(self) -> dict:
        return {
            "codename": self.codename,
            "display_name": self.display_name,
            "description": self.description,
            "tools": self.tools,
            "docker_image": self.docker_image,
            "model": self.model,
            "max_iterations": self.max_iterations,
            "prompt_template": self.prompt_template,
            "tags": self.tags,
            "enabled": self.enabled,
            "created_by": self.created_by,
        }


# Built-in agents (system defaults — user can override but not delete)
BUILTIN_AGENTS: list[AgentDefinition] = [
    AgentDefinition(
        codename="ORCHESTRATOR",
        display_name="Orchestrator",
        description="Mission planner — decomposes requests and delegates to specialists",
        tools=["pentester", "coder", "maintenance", "search", "memorist", "advice",
               "browser", "search_in_memory", "graphiti_search",
               "subtask_list", "subtask_patch", "done", "ask"],
        docker_image=None, max_iterations=100,
        tags=["planner", "delegation"],
    ),
    AgentDefinition(
        codename="PATHFINDER",
        display_name="Pathfinder",
        description="Reconnaissance — subdomain enum, port scanning, content discovery",
        tools=["terminal", "file", "search_in_memory", "store_answer", "store_guide", "done"],
        docker_image="harbinger/pd-tools:latest", max_iterations=100,
        tags=["recon", "discovery"],
    ),
    AgentDefinition(
        codename="BREACH",
        display_name="Breach",
        description="Exploitation — vuln scanning, web attacks, exploit execution",
        tools=["terminal", "file", "browser", "sploitus", "search_in_memory", "store_answer", "done", "ask"],
        docker_image="harbinger/pd-tools:latest", max_iterations=100,
        tags=["exploit", "scanning"],
    ),
    AgentDefinition(
        codename="PHANTOM",
        display_name="Phantom",
        description="Cloud security — AWS/GCP/Azure assessment",
        tools=["terminal", "file", "search_in_memory", "done", "ask"],
        docker_image="harbinger/base:latest", max_iterations=100,
        tags=["cloud", "infrastructure"],
    ),
    AgentDefinition(
        codename="SPECTER",
        display_name="Specter",
        description="OSINT — social engineering research, data gathering",
        tools=["terminal", "file", "search_in_memory", "store_answer", "done"],
        docker_image="harbinger/osint-tools:latest", max_iterations=100,
        tags=["osint", "research"],
    ),
    AgentDefinition(
        codename="CIPHER",
        display_name="Cipher",
        description="Binary analysis — reverse engineering, binary exploitation",
        tools=["terminal", "file", "search_in_memory", "done"],
        docker_image="harbinger/base:latest", max_iterations=100,
        tags=["binary", "reversing"],
    ),
    AgentDefinition(
        codename="SAM",
        display_name="Sam",
        description="Development — code writing, auto-fixing, tool building",
        tools=["terminal", "file", "search_code", "store_code", "done"],
        docker_image="harbinger/dev-tools:latest", max_iterations=100,
        tags=["development", "coding"],
    ),
    AgentDefinition(
        codename="SCRIBE",
        display_name="Scribe",
        description="Report writer — synthesize findings into structured reports",
        tools=["search_in_memory", "search_guide", "search_answer", "graphiti_search", "report_result", "done"],
        docker_image="harbinger/base:latest", max_iterations=20,
        tags=["reporting"],
    ),
    AgentDefinition(
        codename="SAGE",
        display_name="Sage",
        description="Knowledge — past findings, technique lookup",
        tools=["search_in_memory", "search_guide", "graphiti_search", "done"],
        docker_image="harbinger/base:latest", max_iterations=20,
        tags=["knowledge", "memory"],
    ),
    AgentDefinition(
        codename="MAINTAINER",
        display_name="Maintainer",
        description="DevOps — tool installation, environment setup",
        tools=["terminal", "file", "done"],
        docker_image="harbinger/dev-tools:latest", max_iterations=100,
        tags=["devops", "infrastructure"],
    ),
    AgentDefinition(
        codename="LENS",
        display_name="Lens",
        description="Browser automation — authenticated testing, screenshots",
        tools=["terminal", "browser", "file", "done"],
        docker_image="harbinger/base:latest", max_iterations=50,
        tags=["browser", "web"],
    ),
    AgentDefinition(
        codename="ADVISER",
        display_name="Adviser",
        description="Strategic mentor — guidance on difficult situations",
        tools=["search_in_memory", "graphiti_search", "done"],
        docker_image=None, max_iterations=20,
        tags=["strategy", "guidance"],
    ),
]


class AgentRegistry:
    """Registry of all agent types. Users can add/modify agents."""

    def __init__(self):
        self._agents: dict[str, AgentDefinition] = {}
        self._builtin: set[str] = set()
        # Load builtins
        for agent in BUILTIN_AGENTS:
            self._agents[agent.codename] = agent
            self._builtin.add(agent.codename)

    def get(self, codename: str) -> AgentDefinition | None:
        return self._agents.get(codename.upper())

    def list_all(self, enabled_only: bool = False) -> list[dict]:
        agents = self._agents.values()
        if enabled_only:
            agents = [a for a in agents if a.enabled]
        return [a.to_dict() for a in agents]

    def register(self, agent: AgentDefinition):
        if agent.codename in self._builtin:
            raise ValueError(f"Cannot replace built-in agent '{agent.codename}'. Use update() instead.")
        self._agents[agent.codename.upper()] = agent
        logger.info("Registered custom agent: %s", agent.codename)

    def update(self, codename: str, **kwargs):
        """Update an existing agent's config (including built-ins)."""
        agent = self._agents.get(codename.upper())
        if not agent:
            raise ValueError(f"Agent '{codename}' not found")
        for key, value in kwargs.items():
            if hasattr(agent, key):
                setattr(agent, key, value)
        agent.updated_at = time.time()

    def unregister(self, codename: str):
        if codename.upper() in self._builtin:
            raise ValueError(f"Cannot delete built-in agent '{codename}'. Disable it instead.")
        self._agents.pop(codename.upper(), None)

    def is_builtin(self, codename: str) -> bool:
        return codename.upper() in self._builtin

    def get_config(self, codename: str) -> dict:
        """Get agent config in the format executor.py expects."""
        agent = self.get(codename)
        if not agent:
            return {"tools": ["terminal", "file", "done"], "docker_image": "harbinger/base:latest", "max_iterations": 50}
        return {
            "tools": agent.tools,
            "docker_image": agent.docker_image,
            "max_iterations": agent.max_iterations,
            "model": agent.model,
        }


# Singleton
agent_registry = AgentRegistry()
