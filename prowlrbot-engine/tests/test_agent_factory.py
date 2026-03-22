def test_build_agent_chain():
    from src.agents.factory import build_agent_chain

    chain = build_agent_chain(
        "PATHFINDER",
        1,
        1,
        "Find subdomains",
        {"target": "example.com", "mission_type": "pentest", "scope": "*"},
    )
    assert chain[0]["role"] == "system"
    assert chain[1]["role"] == "user"
    assert "subdomains" in chain[1]["content"]


def test_load_prompt_fallback():
    from src.agents.factory import load_prompt

    prompt = load_prompt("nonexistent_agent", {"agent_name": "TEST"})
    assert "TEST" in prompt
