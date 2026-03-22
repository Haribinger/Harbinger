"""Agent factory — build agent chains with role-specific prompts."""
from pathlib import Path

PROMPTS_DIR = Path(__file__).parent / "prompts"


def load_prompt(agent_type: str, context: dict) -> str:
    prompt_file = PROMPTS_DIR / f"{agent_type.lower()}.txt"
    if not prompt_file.exists():
        prompt_file = PROMPTS_DIR / "specialist_base.txt"
    if not prompt_file.exists():
        return f"You are {context.get('agent_name', agent_type)}, a Harbinger security agent."

    template = prompt_file.read_text()
    if "{{specialist_base}}" in template:
        base_file = PROMPTS_DIR / "specialist_base.txt"
        if base_file.exists():
            base = base_file.read_text()
            for key, value in context.items():
                base = base.replace("{{" + key + "}}", str(value))
            template = template.replace("{{specialist_base}}", base)

    for key, value in context.items():
        template = template.replace("{{" + key + "}}", str(value))
    return template


def build_agent_chain(codename: str, mission_id: int, task_id: int, task_input: str, context: dict) -> list[dict]:
    prompt_context = {
        "agent_name": codename,
        "codename": codename,
        "mission_id": str(mission_id),
        "task_id": str(task_id),
        **context,
    }
    system_prompt = load_prompt(codename, prompt_context)
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": task_input},
    ]
