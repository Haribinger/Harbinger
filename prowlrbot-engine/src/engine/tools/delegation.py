"""
Delegation tools — allow ORCHESTRATOR to spawn specialist sub-agents.

Each delegation tool creates a sub-agent ReAct chain with a narrower tool set
and limited iterations.  The sub-agent shares the parent task's container
(when applicable) so file system state is visible.

Usage in AGENT_CONFIG:
    "ORCHESTRATOR": {
        "tools": ["pentester", "coder", "maintenance", "search", "memorist", "advice", ...],
        ...
    }
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


# ── Delegation tool schemas ──────────────────────────────────────────────────

DELEGATION_SCHEMAS: dict[str, dict[str, Any]] = {
    "pentester": {
        "name": "pentester",
        "description": (
            "Delegate to pentester specialist (BREACH) for vulnerability scanning "
            "and exploitation. Provide the task and relevant context."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "What the pentester should do",
                },
                "context": {
                    "type": "string",
                    "description": "Relevant context (target, scope, prior findings)",
                },
            },
            "required": ["task"],
        },
    },
    "coder": {
        "name": "coder",
        "description": (
            "Delegate to developer specialist (SAM) for code writing, "
            "script creation, exploit development, or tooling."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "What to code/build/fix",
                },
                "language": {
                    "type": "string",
                    "description": "Programming language (python, go, bash, etc.)",
                },
                "context": {
                    "type": "string",
                    "description": "Relevant context (existing code, requirements)",
                },
            },
            "required": ["task"],
        },
    },
    "maintenance": {
        "name": "maintenance",
        "description": (
            "Delegate to DevOps specialist (MAINTAINER) for tool installation, "
            "environment setup, container configuration."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "What to install/configure/fix",
                },
                "context": {
                    "type": "string",
                    "description": "Current state and requirements",
                },
            },
            "required": ["task"],
        },
    },
    "search": {
        "name": "search",
        "description": (
            "Delegate to researcher specialist (SPECTER) for OSINT, "
            "web research, intelligence gathering."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "What to research",
                },
                "instructions": {
                    "type": "string",
                    "description": "How to approach the research",
                },
            },
            "required": ["query"],
        },
    },
    "memorist": {
        "name": "memorist",
        "description": (
            "Delegate to archivist specialist (SAGE) for querying past findings, "
            "stored knowledge, and mission history."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "What to look up in memory/knowledge",
                },
            },
            "required": ["question"],
        },
    },
    "advice": {
        "name": "advice",
        "description": (
            "Get strategic guidance from the ADVISER. Use when stuck, facing "
            "multiple options, or needing a second opinion."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "situation": {
                    "type": "string",
                    "description": "Current situation and what you've tried",
                },
                "options": {
                    "type": "string",
                    "description": "Available options you're considering",
                },
            },
            "required": ["situation"],
        },
    },
}

# Map delegation tool names to agent codenames
DELEGATION_AGENTS: dict[str, str] = {
    "pentester": "BREACH",
    "coder": "SAM",
    "maintenance": "MAINTAINER",
    "search": "SPECTER",
    "memorist": "SAGE",
    "advice": "ADVISER",
}

# Max iterations for specialist sub-agents (less than ORCHESTRATOR's 100)
SPECIALIST_MAX_ITERATIONS: dict[str, int] = {
    "pentester": 50,
    "coder": 50,
    "maintenance": 30,
    "search": 20,
    "memorist": 20,
    "advice": 10,
}


class DelegationTool:
    """A delegation tool that spawns a specialist sub-agent.

    The sub-agent runs its own ReAct loop with the performer, using the
    parent container for tool execution. Results are returned as a string
    to the calling agent's chain.
    """

    def __init__(
        self,
        tool_name: str,
        container_id: str | None = None,
        docker_client=None,
        llm=None,
    ):
        if tool_name not in DELEGATION_SCHEMAS:
            raise ValueError(f"Unknown delegation tool: {tool_name}")
        self.tool_name = tool_name
        self.agent_codename = DELEGATION_AGENTS[tool_name]
        # Specialists get the smaller of the hardcoded limit and half the agent's
        # configured max — so a user bumping an agent's max_iterations doesn't
        # accidentally let sub-agents run wild.
        from src.registry.agents import agent_registry
        agent_config = agent_registry.get_config(DELEGATION_AGENTS[tool_name])
        base_limit = SPECIALIST_MAX_ITERATIONS.get(tool_name, 20)
        registry_limit = agent_config.get("max_iterations", 100) // 2
        self.max_iterations = min(base_limit, registry_limit) if registry_limit > 0 else base_limit
        self._container_id = container_id
        self._docker_client = docker_client
        self._llm = llm

    def schema(self) -> dict:
        return DELEGATION_SCHEMAS[self.tool_name]

    async def execute(self, args: dict) -> str:
        """Spawn a specialist sub-agent and return its result."""
        from src.engine.performer import perform_agent_chain
        from src.engine.tools.registry import ToolExecutor

        task_desc = args.get("task") or args.get("query") or args.get("situation", "")
        context = args.get("context") or args.get("instructions") or args.get("options", "")
        language = args.get("language", "")

        # Build specialist prompt
        prompt_parts = [
            f"You are {self.agent_codename}, a Harbinger specialist agent.",
            f"You have been delegated the following task by the ORCHESTRATOR.",
        ]
        if context:
            prompt_parts.append(f"\nContext: {context}")
        if language:
            prompt_parts.append(f"\nLanguage: {language}")
        prompt_parts.append(
            "\nComplete the task and report results using the 'done' tool."
        )

        system_prompt = "\n".join(prompt_parts)
        chain = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": task_desc},
        ]

        # Specialist gets environment tools from the agent registry
        from src.registry.agents import agent_registry

        config = agent_registry.get_config(self.agent_codename)

        # Build a ToolExecutor for the specialist — no delegation tools
        # to prevent recursive delegation chains
        specialist_tools = [
            t for t in config["tools"] if t not in DELEGATION_SCHEMAS
        ]
        executor = ToolExecutor(
            allowed_tools=specialist_tools,
            container_id=self._container_id,
            docker_client=self._docker_client,
        )

        if not self._llm:
            return f"[{self.agent_codename}] No LLM configured — cannot execute delegation."

        logger.info(
            "delegation: %s -> %s (max_iter=%d) task=%s",
            self.tool_name,
            self.agent_codename,
            self.max_iterations,
            task_desc[:80],
        )

        try:
            result = await perform_agent_chain(
                chain=chain,
                executor=executor,
                llm=self._llm,
                max_iterations=self.max_iterations,
            )
            status = result.get("status", "failed")
            output = result.get("result", "No result")
            tokens = result.get("tokens", {})

            return (
                f"[{self.agent_codename}] Status: {status}\n"
                f"Result: {output}\n"
                f"Tokens: in={tokens.get('input', 0)} out={tokens.get('output', 0)}"
            )
        except Exception as exc:
            logger.error("delegation to %s failed: %s", self.agent_codename, exc)
            return f"[{self.agent_codename}] Delegation failed: {exc}"
