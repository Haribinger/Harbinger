"""
Mission task executor — spawns a Docker container, wires up tools, runs the
ReAct loop via perform_agent_chain, and tears down the container when done.

Each task gets its own container so agents are fully isolated.  The container
name encodes the mission/task IDs so it's easy to track in Docker logs.
"""

import logging

from src.agents.config import get_agent_config
from src.agents.llm import LLMAdapter
from src.agents.prompts import build_system_prompt
from src.docker.client import DockerClient
from src.engine.performer import perform_agent_chain
from src.engine.tools.registry import ToolExecutor

logger = logging.getLogger(__name__)

# Agent configuration is the authoritative source from src.agents.config.
# Re-exported here so DelegationTool (delegation.py) can import without a cycle —
# it uses: from src.engine.executor import AGENT_CONFIG, DEFAULT_CONFIG
from src.agents.config import AGENT_CONFIG, DEFAULT_CONFIG  # noqa: E402 (re-export)


async def execute_task(
    task_id: int,
    agent_codename: str,
    docker_image: str | None,
    mission_id: int,
    task_input: str,
    llm=None,
) -> dict:
    """Execute a single mission task, optionally inside an ephemeral Docker container.

    Workflow:
      1. Resolve agent config (tools, image, iteration cap).
      2. If the agent requires a container: create + start it, else run in-process.
      3. Build a ToolExecutor scoped to the container (and LLM for delegation).
      4. Run the ReAct loop via perform_agent_chain.
      5. Stop + remove the container regardless of outcome.

    Returns the dict from perform_agent_chain:
        {"status": "done"|"waiting"|"failed", "result": str,
         "chain": list, "tokens": dict}
    """
    config = get_agent_config(agent_codename)
    effective_image = docker_image or config["docker_image"]

    # Ensure we always have an LLM — fall back to default adapter if the caller
    # didn't provide one (e.g. when the scheduler is started with llm=None).
    effective_llm = llm if llm is not None else LLMAdapter()

    system_prompt = build_system_prompt(
        agent_codename=agent_codename,
        mission_id=mission_id,
        task_id=task_id,
        task_input=task_input,
    )
    chain = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": task_input},
    ]

    # Agents with no docker_image (ORCHESTRATOR, ADVISER) run in-process with
    # delegation/barrier tools only — no container needed.
    if not effective_image:
        executor = ToolExecutor(
            allowed_tools=config["tools"],
            container_id=None,
            docker_client=None,
            llm=effective_llm,
        )
        try:
            return await perform_agent_chain(
                chain=chain,
                executor=executor,
                llm=effective_llm,
                max_iterations=config["max_iterations"],
            )
        except Exception as exc:
            logger.error(
                "in-process task failed — mission=%s task=%s agent=%s: %s",
                mission_id, task_id, agent_codename, exc,
            )
            return {"status": "failed", "result": str(exc), "chain": [], "tokens": {}}

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
            llm=effective_llm,
        )

        return await perform_agent_chain(
            chain=chain,
            executor=executor,
            llm=effective_llm,
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
