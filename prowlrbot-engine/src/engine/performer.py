import json
import time

from src.engine.monitor import ExecutionMonitor
from src.engine.summarizer import summarize_chain, summarize_output
from src.engine.tools.registry import ToolExecutor

RESULT_SIZE_LIMIT = 16384


async def perform_agent_chain(
    chain: list[dict],
    executor: ToolExecutor,
    llm,
    max_iterations: int = 100,
    model: str | None = None,
    on_action=None,
    subtask_id: str = "",
    mission_id: str = "",
    agent_codename: str = "",
) -> dict:
    """Core ReAct loop. Reason -> Act -> Observe -> Repeat.

    Returns: {"status": "done"|"waiting"|"failed", "result": str, "chain": list}
    """
    monitor = ExecutionMonitor(
        same_tool_limit=max(max_iterations // 2, 5),
        total_limit=max_iterations,
    )

    total_tokens = {"input": 0, "output": 0}

    for iteration in range(max_iterations):
        # Call LLM with tools
        response = await llm.call_with_tools(
            chain, executor.get_tool_definitions(), model
        )

        # Track tokens
        usage = response.get("usage", {})
        total_tokens["input"] += usage.get("input", 0)
        total_tokens["output"] += usage.get("output", 0)

        # Hard LLM failure — stop immediately rather than looping max_iterations
        # times nudging a provider that is down.
        if response.get("error"):
            return {
                "status": "failed",
                "result": f"LLM call failed: {response['error']}",
                "chain": chain,
                "tokens": total_tokens,
            }

        tool_calls = response.get("tool_calls", [])

        # No tool calls — LLM is stuck
        if not tool_calls:
            # Append a nudge
            chain.append({
                "role": "system",
                "content": "You did not call any tool. You must call a tool to make progress, or call 'done' to finish.",
            })
            continue

        # Execute each tool call
        for tc in tool_calls:
            tool_name = tc["name"]
            tool_args = tc.get("args", {})

            # Execution monitor check
            check = monitor.check(tool_name)
            if check == "abort":
                return {
                    "status": "failed",
                    "result": f"Aborted: exceeded {max_iterations} total tool calls",
                    "chain": chain,
                    "tokens": total_tokens,
                }
            elif check == "adviser":
                chain.append({
                    "role": "system",
                    "content": f"WARNING: You have called '{tool_name}' repeatedly. Try a different approach or call 'done' to finish.",
                })
                continue

            # Execute the tool
            start = time.time()
            result = await executor.execute(tool_name, tool_args)
            duration = time.time() - start

            # Callback for observability
            if on_action:
                await on_action(tool_name, tool_args, result, duration)

            # Check barriers
            if tool_name == "done":
                return {
                    "status": "done",
                    "result": tool_args.get("result", result),
                    "chain": chain,
                    "tokens": total_tokens,
                }
            elif tool_name == "ask":
                # Lazy import to avoid circular deps at module load
                from src.engine.ask_barrier import ask_barrier

                question = tool_args.get("question", "Need operator input")
                options = tool_args.get("options")
                # Use caller-supplied subtask_id, fall back to iteration-scoped id
                effective_subtask_id = subtask_id or f"ask-{iteration}"

                operator_response = await ask_barrier.ask(
                    subtask_id=effective_subtask_id,
                    mission_id=mission_id,
                    agent_codename=agent_codename,
                    question=question,
                    options=options,
                )

                # Feed the operator's answer back into the chain and continue
                chain.append({
                    "role": "tool",
                    "tool_call_id": tc.get("id", "ask"),
                    "name": "ask",
                    "content": f"Operator response: {operator_response}",
                })
                # Do not return — resume the ReAct loop with the response injected

            # Summarize large output
            if len(result) > RESULT_SIZE_LIMIT:
                result = await summarize_output(result, tool_name)

            # Append tool result to chain
            chain.append({
                "role": "tool",
                "tool_call_id": tc.get("id", tool_name),
                "name": tool_name,
                "content": result,
            })

        # Summarize chain if too long
        if len(chain) > 50:
            chain = await summarize_chain(chain, keep_recent=10)

    # Max iterations reached
    return {
        "status": "failed",
        "result": f"Max iterations ({max_iterations}) reached without completion",
        "chain": chain,
        "tokens": total_tokens,
    }
