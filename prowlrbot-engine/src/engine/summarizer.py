RESULT_SIZE_LIMIT = 16384  # 16KB
CHAIN_LENGTH_LIMIT = 50    # messages


async def summarize_output(output: str, tool_name: str, llm_fn=None) -> str:
    """Summarize large tool output to fit context window."""
    if len(output) <= RESULT_SIZE_LIMIT:
        return output

    if llm_fn is None:
        return (
            output[:RESULT_SIZE_LIMIT]
            + f"\n\n[... truncated {len(output) - RESULT_SIZE_LIMIT * 2} bytes ...]\n\n"
            + output[-RESULT_SIZE_LIMIT:]
        )

    prompt = (
        f"Summarize this {tool_name} output, preserving:\n"
        "- All findings, vulnerabilities, and security-relevant data\n"
        "- All IP addresses, hostnames, ports, and URLs\n"
        "- All error messages and their context\n"
        "- Key metrics and counts\n\n"
        f"Output ({len(output)} bytes):\n{output[:RESULT_SIZE_LIMIT * 2]}"
    )
    return await llm_fn(prompt)


async def summarize_chain(chain: list[dict], keep_recent: int = 10, llm_fn=None) -> list[dict]:
    """Compress long agent message chains, preserving recent context."""
    if len(chain) <= CHAIN_LENGTH_LIMIT:
        return chain

    old = chain[:-keep_recent]
    recent = chain[-keep_recent:]

    if llm_fn is None:
        system_msgs = [m for m in old if m.get("role") == "system"]
        return system_msgs + recent

    old_text = "\n".join(
        f"[{m.get('role', '?')}]: {str(m.get('content', ''))[:500]}"
        for m in old
    )

    summary = await llm_fn(
        f"Summarize this agent conversation history, preserving all "
        f"findings, decisions, and tool results:\n\n{old_text}"
    )

    return [
        {"role": "system", "content": f"[Previous context summary]\n{summary}"},
        *recent,
    ]
