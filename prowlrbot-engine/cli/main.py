"""
Harbinger CLI — Command-line interface for the Autonomous Security OS.

Usage:
  harbinger mission start "pentest example.com"
  harbinger mission status 1
  harbinger mission list
  harbinger agents watch
  harbinger agents watch --agent PATHFINDER
  harbinger warroom 123
  harbinger findings stream 123
  harbinger agent attach PATHFINDER
"""

import json
import time

import typer
from rich.console import Console
from rich.table import Table
from rich.live import Live
from rich.panel import Panel
from rich.text import Text

from cli.client import api_get, api_post, sse_stream
from cli.ingest import ingest_app
from cli.train import train_app

app = typer.Typer(
    name="harbinger",
    help="Harbinger v2.0 — Autonomous Security Operating System",
    no_args_is_help=True,
)
console = Console()

# Register sub-command groups
app.add_typer(ingest_app, name="ingest")
app.add_typer(train_app, name="train")

# ── Mission commands ─────────────────────────────────────────────────────────

mission_app = typer.Typer(help="Mission management")
app.add_typer(mission_app, name="mission")


@mission_app.command("start")
def mission_start(
    title: str = typer.Argument(..., help="Mission title or description"),
    target: str = typer.Option(None, "--target", "-t", help="Target domain/IP"),
    mission_type: str = typer.Option("custom", "--type", help="Mission type"),
    autonomy: int = typer.Option(1, "--autonomy", "-a", help="Autonomy level (0-4)"),
    execute: bool = typer.Option(False, "--execute", "-x", help="Execute immediately after creation"),
):
    """Create a new mission."""
    data = {
        "title": title,
        "target": target,
        "mission_type": mission_type,
        "autonomy_level": autonomy,
    }
    result = api_post("/api/v2/missions", data)
    mission_id = result.get("id", "?")
    console.print(f"[green]Mission #{mission_id} created:[/] {result.get('title', title)}")

    if execute:
        api_post(f"/api/v2/missions/{mission_id}/execute")
        console.print(f"[yellow]Mission #{mission_id} executing...[/]")


@mission_app.command("status")
def mission_status(mission_id: int = typer.Argument(..., help="Mission ID")):
    """Show mission status and task overview."""
    state = api_get(f"/api/v2/warroom/{mission_id}/state")

    # Mission header
    status = state.get("status", "unknown")
    color = {"running": "yellow", "finished": "green", "failed": "red"}.get(status, "white")
    console.print(Panel(
        f"[bold]{state.get('title', '?')}[/]\n"
        f"Status: [{color}]{status}[/]  |  "
        f"Subscribers: {state.get('subscriber_count', 0)}  |  "
        f"Events: {state.get('event_count', 0)}",
        title=f"Mission #{mission_id}",
        border_style="yellow",
    ))

    # Task table
    tasks = state.get("tasks", [])
    if tasks:
        table = Table(title="Tasks", border_style="dim")
        table.add_column("ID", style="dim", width=6)
        table.add_column("Title", min_width=20)
        table.add_column("Agent", style="cyan")
        table.add_column("Status", width=10)
        table.add_column("Deps", style="dim")

        for t in tasks:
            s = t.get("status", "?")
            sc = {"running": "yellow", "finished": "green", "failed": "red", "queued": "white"}.get(s, "dim")
            deps = ", ".join(str(d) for d in t.get("depends_on", []))
            table.add_row(
                str(t.get("id", "?")),
                t.get("title", "?"),
                t.get("agent_codename", "—"),
                f"[{sc}]{s}[/]",
                deps or "—",
            )
        console.print(table)

    # Agent statuses
    agents = state.get("agents", [])
    if agents:
        console.print("\n[bold]Agents:[/]")
        for a in agents:
            s = a.get("status", "idle")
            sc = {"executing": "green", "waiting": "yellow", "error": "red"}.get(s, "dim")
            task = a.get("current_task", "")
            console.print(f"  [{sc}]●[/] {a.get('codename', '?')} — {s}" + (f" ({task})" if task else ""))


@mission_app.command("list")
def mission_list():
    """List all missions."""
    missions = api_get("/api/v2/missions")
    if not missions:
        console.print("[dim]No missions found[/]")
        return

    table = Table(title="Missions", border_style="dim")
    table.add_column("ID", style="dim", width=6)
    table.add_column("Title", min_width=20)
    table.add_column("Type", style="cyan", width=12)
    table.add_column("Target", width=20)
    table.add_column("Status", width=10)

    for m in missions:
        s = m.get("status", "?")
        sc = {"running": "yellow", "finished": "green", "failed": "red"}.get(s, "dim")
        table.add_row(
            str(m.get("id", "?")),
            m.get("title", "?"),
            m.get("mission_type", "?"),
            m.get("target", "—") or "—",
            f"[{sc}]{s}[/]",
        )
    console.print(table)


# ── Agents commands ──────────────────────────────────────────────────────────

agents_app = typer.Typer(help="Agent monitoring")
app.add_typer(agents_app, name="agents")


@agents_app.command("watch")
def agents_watch(
    agent: str = typer.Option(None, "--agent", "-a", help="Filter by agent codename"),
    mission: int = typer.Option(None, "--mission", "-m", help="Filter by mission ID"),
):
    """Live stream of agent activity."""
    console.print("[yellow]Watching agent activity...[/] (Ctrl+C to stop)\n")

    def on_event(event: dict):
        ts = time.strftime("%H:%M:%S", time.localtime(event.get("timestamp", time.time())))
        source = event.get("source", "?")
        etype = event.get("type", "?")
        payload = event.get("payload", {})

        if agent and source.upper() != agent.upper():
            return

        color = {
            "agent_status": "cyan",
            "command_output": "white",
            "task_update": "yellow",
            "action_log": "green",
            "system_alert": "red",
        }.get(etype, "dim")

        text = ""
        if etype == "command_output":
            stream = payload.get("stream", "stdout")
            data = payload.get("data", "")
            sc = "red" if stream == "stderr" else "white"
            text = f"[{sc}]{data}[/]"
        elif etype == "task_update":
            text = f"{payload.get('action', '?')} — task {payload.get('task_id', '?')}"
        elif etype == "agent_status":
            text = f"{payload.get('status', '?')}"
        else:
            text = json.dumps(payload)[:100]

        console.print(f"[dim]{ts}[/] [{color}]{etype:20s}[/] [cyan]{source:12s}[/] {text}")

    if mission:
        sse_stream(f"/api/v2/warroom/{mission}/stream", on_event)
    else:
        # Subscribe to all events via the system stream
        sse_stream("/api/v2/warroom/0/stream", on_event)


# ── War Room command ─────────────────────────────────────────────────────────

@app.command("warroom")
def warroom(
    mission_id: int = typer.Argument(..., help="Mission ID"),
):
    """Live War Room dashboard for a mission."""
    console.print(f"[yellow]War Room — Mission #{mission_id}[/] (Ctrl+C to stop)\n")

    def on_event(event: dict):
        ts = time.strftime("%H:%M:%S", time.localtime(event.get("timestamp", time.time())))
        source = event.get("source", "?")
        etype = event.get("type", "?")
        payload = event.get("payload", {})
        target = event.get("target", "broadcast")

        is_replay = event.get("_replay", False)
        prefix = "[dim](replay)[/] " if is_replay else ""

        color = {
            "agent_status": "cyan",
            "command_output": "white",
            "task_update": "yellow",
            "subtask_update": "yellow",
            "action_log": "green",
            "operator_action": "magenta",
            "mission_update": "blue",
            "system_alert": "red",
        }.get(etype, "dim")

        msg = ""
        if etype == "command_output":
            stream = payload.get("stream", "stdout")
            data = str(payload.get("data", ""))[:120]
            sc = "red" if stream == "stderr" else "white"
            msg = f"[{sc}]{data}[/]"
        elif etype in ("task_update", "subtask_update"):
            msg = f"{payload.get('action', '?')}"
        elif etype == "operator_action":
            msg = f"{payload.get('action', '?')}: {str(payload.get('command', ''))[:60]}"
        else:
            msg = json.dumps(payload)[:100]

        console.print(f"{prefix}[dim]{ts}[/] [{color}]{etype:20s}[/] {source:12s} → {target:12s} {msg}")

    sse_stream(f"/api/v2/warroom/{mission_id}/stream", on_event)


# ── Findings stream ──────────────────────────────────────────────────────────

@app.command("findings")
def findings_stream(
    mission_id: int = typer.Argument(..., help="Mission ID"),
):
    """Stream findings from a mission in real-time."""
    console.print(f"[yellow]Findings stream — Mission #{mission_id}[/] (Ctrl+C to stop)\n")

    def on_event(event: dict):
        etype = event.get("type", "")
        if etype not in ("action_log", "task_update"):
            return

        payload = event.get("payload", {})
        source = event.get("source", "?")
        ts = time.strftime("%H:%M:%S", time.localtime(event.get("timestamp", time.time())))

        # Only show completed actions with results
        output = payload.get("output") or payload.get("result") or payload.get("data")
        if not output:
            return

        tool = payload.get("tool_name", payload.get("action", "?"))
        console.print(f"\n[dim]{ts}[/] [cyan]{source}[/] — [yellow]{tool}[/]")
        # Truncate very long outputs
        output_str = str(output)
        if len(output_str) > 500:
            output_str = output_str[:500] + f"\n... ({len(output_str) - 500} more bytes)"
        console.print(output_str)

    sse_stream(f"/api/v2/warroom/{mission_id}/stream", on_event)


# ── Agent attach (delegates to Agent Shell) ──────────────────────────────────

@app.command("attach")
def agent_attach(
    agent: str = typer.Argument(..., help="Agent codename (e.g. PATHFINDER)"),
):
    """Attach to an agent's Docker container for manual commands."""
    # Create shell session via the Go backend (Agent Shell)
    result = api_post("/api/shell/attach", {"agent": agent})
    session = result.get("session", {})
    session_id = session.get("id")
    agent_name = session.get("agent_name", agent)
    container = session.get("container_id", "?")[:12]

    console.print(f"[green]Attached to {agent_name}[/] (container {container})")
    console.print("[dim]Type commands. Ctrl+C to detach.[/]\n")

    while True:
        try:
            cmd = console.input(f"[yellow]{agent_name.lower()}$[/] ")
            if not cmd.strip():
                continue

            # Execute via SSE streaming
            def on_event(event: dict):
                if event.get("type") == "done":
                    code = event.get("exit_code", -1)
                    if code != 0:
                        console.print(f"[dim][exit {code}][/]")
                else:
                    stream = event.get("stream", "stdout")
                    data = event.get("data", "")
                    if stream == "stderr":
                        console.print(f"[red]{data}[/]", end="")
                    else:
                        console.print(data, end="")

            sse_stream(f"/api/shell/{session_id}/exec", on_event)

        except (KeyboardInterrupt, EOFError):
            console.print(f"\n[dim]Detaching from {agent_name}...[/]")
            try:
                import httpx
                httpx.delete(
                    f"{__import__('cli.client', fromlist=['get_base_url']).get_base_url()}/api/shell/{session_id}",
                    headers={"Authorization": f"Bearer {__import__('cli.client', fromlist=['get_token']).get_token()}"},
                )
            except Exception:
                pass
            break


def main():
    app()


if __name__ == "__main__":
    main()
