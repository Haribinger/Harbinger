"""Agent configuration — tools, Docker images, iteration limits per role."""

AGENT_CONFIG: dict[str, dict] = {
    "ORCHESTRATOR": {
        "tools": ["pentester", "coder", "maintenance", "search", "memorist", "advice",
                  "browser", "search_in_memory", "graphiti_search",
                  "subtask_list", "subtask_patch", "done", "ask"],
        "docker_image": None,
        "max_iterations": 100,
        "model": None,
    },
    "PATHFINDER": {
        "tools": ["terminal", "file", "search_in_memory", "store_answer", "store_guide", "done"],
        "docker_image": "harbinger/pd-tools:latest",
        "max_iterations": 100,
        "model": None,
    },
    "BREACH": {
        "tools": ["terminal", "file", "browser", "sploitus", "search_in_memory", "store_answer", "done", "ask"],
        "docker_image": "harbinger/pd-tools:latest",
        "max_iterations": 100,
        "model": None,
    },
    "PHANTOM": {
        "tools": ["terminal", "file", "search_in_memory", "done", "ask"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 100,
        "model": None,
    },
    "SPECTER": {
        "tools": ["terminal", "file", "search_in_memory", "store_answer", "done"],
        "docker_image": "harbinger/osint-tools:latest",
        "max_iterations": 100,
        "model": None,
    },
    "CIPHER": {
        "tools": ["terminal", "file", "search_in_memory", "done"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 100,
        "model": None,
    },
    "SAM": {
        "tools": ["terminal", "file", "search_code", "store_code", "done"],
        "docker_image": "harbinger/dev-tools:latest",
        "max_iterations": 100,
        "model": None,
    },
    "SCRIBE": {
        "tools": ["search_in_memory", "search_guide", "search_answer", "graphiti_search", "report_result", "done"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 20,
        "model": None,
    },
    "SAGE": {
        "tools": ["search_in_memory", "search_guide", "graphiti_search", "done"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 20,
        "model": None,
    },
    "MAINTAINER": {
        "tools": ["terminal", "file", "done"],
        "docker_image": "harbinger/dev-tools:latest",
        "max_iterations": 100,
        "model": None,
    },
    "LENS": {
        "tools": ["terminal", "browser", "file", "done"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 50,
        "model": None,
    },
    "ADVISER": {
        "tools": ["search_in_memory", "graphiti_search", "done"],
        "docker_image": None,
        "max_iterations": 20,
        "model": None,
    },
}

DEFAULT_CONFIG = {
    "tools": ["terminal", "file", "done"],
    "docker_image": "harbinger/base:latest",
    "max_iterations": 50,
    "model": None,
}

def get_agent_config(codename: str) -> dict:
    return AGENT_CONFIG.get(codename.upper(), DEFAULT_CONFIG)
