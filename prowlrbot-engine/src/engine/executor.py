"""
Mission task executor — spawns a Docker container, wires up tools, runs the
ReAct loop via perform_agent_chain, and tears down the container when done.

Each task gets its own container so agents are fully isolated.  The container
name encodes the mission/task IDs so it's easy to track in Docker logs.
"""

import logging

from src.docker.client import DockerClient
from src.engine.performer import perform_agent_chain
from src.engine.tools.registry import ToolExecutor

logger = logging.getLogger(__name__)

# Per-agent configuration: tools the agent may call and the default Docker
# image to use when the caller doesn't override it.  max_iterations caps the
# ReAct loop so a runaway agent can't consume unbounded LLM tokens.
AGENT_CONFIG: dict[str, dict] = {
    "PATHFINDER": {
        "tools": ["terminal", "file", "done"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 100,
    },
    "BREACH": {
        "tools": ["terminal", "file", "done", "ask"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 100,
    },
    "SAM": {
        "tools": ["terminal", "file", "done"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 100,
    },
    "SCRIBE": {
        "tools": ["done"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 20,
    },
}

# Fallback for agents not listed above
DEFAULT_CONFIG: dict = {
    "tools": ["terminal", "file", "done"],
    "docker_image": "harbinger/base:latest",
    "max_iterations": 50,
}


async def execute_task(
    task_id: int,
    agent_codename: str,
    docker_image: str | None,
    mission_id: int,
    task_input: str,
    llm,
) -> dict:
    """Execute a single mission task inside an ephemeral Docker container.

    Workflow:
      1. Resolve agent config (tools, image, iteration cap).
      2. Create + start a container named after mission/task IDs.
      3. Build a ToolExecutor scoped to the container.
      4. Run the ReAct loop via perform_agent_chain.
      5. Stop + remove the container regardless of outcome.

    Returns the dict from perform_agent_chain:
        {"status": "done"|"waiting"|"failed", "result": str,
         "chain": list, "tokens": dict}
    """
    config = AGENT_CONFIG.get(agent_codename.upper(), DEFAULT_CONFIG)
    effective_image = docker_image or config["docker_image"]

    # Workspace on the host bind-mounted at /work inside the container.
    # Each mission gets its own directory so parallel tasks don't collide.
    workspace = f"/tmp/harbinger/missions/{mission_id}"
    container_name = (
        f"harbinger-m{mission_id}-{agent_codename.lower()}-t{task_id}"
    )

    docker = DockerClient()
    container_id: str | None = None

    try:
        container_config = docker.build_container_config(
            image=effective_image,
            name=container_name,
            env={
                "MISSION_ID": str(mission_id),
                "TASK_ID": str(task_id),
                "AGENT": agent_codename,
            },
            workspace=workspace,
        )
        container_id = await docker.create_container(container_name, container_config)
        await docker.start_container(container_id)

        logger.info(
            "container started — mission=%s task=%s agent=%s container=%s",
            mission_id,
            task_id,
            agent_codename,
            container_id[:12],
        )

        executor = ToolExecutor(
            allowed_tools=config["tools"],
            container_id=container_id,
            docker_client=docker,
        )

        system_prompt = (
            f"You are {agent_codename}, a Harbinger security agent.\n"
            f"Mission {mission_id}, task {task_id}.\n"
            f"Execute the task and report results using the 'done' tool.\n\n"
            f"Task: {task_input}"
        )
        chain = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": task_input},
        ]

        return await perform_agent_chain(
            chain=chain,
            executor=executor,
            llm=llm,
            max_iterations=config["max_iterations"],
        )

    except Exception as exc:
        logger.error(
            "task execution failed — mission=%s task=%s: %s",
            mission_id,
            task_id,
            exc,
        )
        return {
            "status": "failed",
            "result": str(exc),
            "chain": [],
            "tokens": {},
        }

    finally:
        # Always clean up the container — leaking containers wastes resources
        # and can expose sensitive data between missions.
        if container_id is not None:
            try:
                await docker.stop_container(container_id)
                await docker.remove_container(container_id)
            except Exception:
                # Container may already be stopped/removed; not a fatal error
                pass
        await docker.close()
