"""
Harbinger CLI — Multi-terminal command center for autonomous security operations.

Terminal roles:
  T1: harbinger mission start "pentest example.com"   — Mission Control
  T2: harbinger agents watch [--agent BREACH]          — Agent Watch
  T3: harbinger findings stream --mission 123          — Findings Feed
  T4: harbinger warroom --mission 123                  — War Room TUI
  T7: harbinger healing watch                          — Self-Healing Monitor
"""

from __future__ import annotations

import json
import signal
import sys
import time
from datetime import datetime
from typing import Optional

import typer
import httpx
from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.markup import escape

app = typer.Typer(
    name="harbinger",
    help="Harbinger v2.0 — Autonomous Security Operating System CLI",
    no_args_is_help=True,
)
console = Console()

# ── Config ──────────────────────────────────────────────────────────────────

DEFAULT_API_BASE = "http://localhost:8000"
DEFAULT_GO_API_BASE = "http://localhost:8080"


def get_api_base() -> str:
    import os
    return os.environ.get("HARBINGER_API", DEFAULT_API_BASE)


def get_go_api_base() -> str:
    import os
    return os.environ.get("HARBINGER_GO_API", DEFAULT_GO_API_BASE)


def get_auth_token() -> str:
    import os
    return os.environ.get("HARBINGER_TOKEN", "")


def api_headers() -> dict[str, str]:
    token = get_auth_token()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


# ── Severity / status color helpers ─────────────────────────────────────────

SEVERITY_COLORS = {
    "critical": "bold red",
    "high": "red",
    "warning": "yellow",
    "medium": "yellow",
    "info": "cyan",
    "low": "blue",
}

STATUS_COLORS = {
    "running": "bold green",
    "finished": "green",
    "failed": "bold red",
    "waiting": "yellow",
    "created": "dim",
    "queued": "dim cyan",
    "paused": "yellow",
    "cancelled": "dim red",
    "planning": "cyan",
}

HEAL_TYPE_ICONS = {
    "container_restart": "🔄",
    "oom_restart": "💾",
    "timeout_kill": "⏱️",
    "stall_nudge": "👋",
    "escalation": "🚨",
    "diagnosis": "🔍",
    "monitor_start": "▶️",
    "monitor_stop": "⏹️",
}


def severity_text(severity: str) -> Text:
    style = SEVERITY_COLORS.get(severity.lower(), "white")
    return Text(severity.upper(), style=style)


def status_text(status: str) -> Text:
    style = STATUS_COLORS.get(status.lower(), "white")
    return Text(status, style=style)


def timestamp_short(ts: str) -> str:
    """Parse ISO timestamp and return HH:MM:SS."""
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt.strftime("%H:%M:%S")
    except (ValueError, AttributeError):
        return ts[:8] if len(ts) >= 8 else ts


# ── SSE stream helper ───────────────────────────────────────────────────────

def stream_sse(url: str, channel: str = "", on_event=None, headers: dict | None = None):
    """Connect to an SSE endpoint and call on_event for each event.

    Uses httpx streaming. Reconnects on disconnect. Ctrl+C to stop.
    """
    params = {}
    if channel:
        params["channel"] = channel
    token = get_auth_token()
    if token:
        params["token"] = token

    hdrs = headers or {}

    while True:
        try:
            with httpx.stream("GET", url, params=params, headers=hdrs, timeout=None) as resp:
                resp.raise_for_status()
                buffer = ""
                for chunk in resp.iter_text():
                    buffer += chunk
                    while "\n\n" in buffer:
                        raw, buffer = buffer.split("\n\n", 1)
                        for line in raw.split("\n"):
                            if line.startswith("data: "):
                                data = line[6:]
                                try:
                                    event = json.loads(data)
                                    if on_event:
                                        on_event(event)
                                except json.JSONDecodeError:
                                    pass
        except httpx.HTTPStatusError as e:
            console.print(f"[red]HTTP {e.response.status_code}[/red] — retrying in 3s...")
            time.sleep(3)
        except (httpx.ConnectError, httpx.ReadError, httpx.RemoteProtocolError):
            console.print("[yellow]Connection lost — reconnecting in 3s...[/yellow]")
            time.sleep(3)
        except KeyboardInterrupt:
            break


# ═══════════════════════════════════════════════════════════════════════════
# T1: MISSION CONTROL
# ═══════════════════════════════════════════════════════════════════════════

mission_app = typer.Typer(help="Mission management — create, start, monitor, cancel")
app.add_typer(mission_app, name="mission")


@mission_app.command("start")
def mission_start(
    description: str = typer.Argument(..., help="Mission description, e.g. 'pentest example.com'"),
    target: Optional[str] = typer.Option(None, "--target", "-t", help="Primary target"),
    mission_type: str = typer.Option("custom", "--type", help="Mission type: full_pentest, bug_bounty, red_team, code_audit, custom"),
    autonomy: str = typer.Option("supervised", "--autonomy", "-a", help="Autonomy level: manual, supervised, autonomous"),
):
    """Create and start a new mission."""
    console.print(Panel(
        f"[bold gold1]HARBINGER[/bold gold1] — Starting mission\n"
        f"[dim]Type:[/dim] {mission_type}  [dim]Autonomy:[/dim] {autonomy}\n"
        f"[dim]Target:[/dim] {target or 'from description'}\n"
        f"[bold]{escape(description)}[/bold]",
        border_style="gold1",
    ))

    base = get_api_base()
    try:
        resp = httpx.post(
            f"{base}/api/v2/missions",
            json={
                "title": description,
                "target": target or "",
                "mission_type": mission_type,
                "autonomy_level": autonomy,
            },
            headers=api_headers(),
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
    except httpx.ConnectError:
        console.print("[red]Cannot connect to Harbinger engine.[/red] Is it running on port 8000?")
        raise typer.Exit(1)
    except httpx.HTTPStatusError as e:
        console.print(f"[red]Error {e.response.status_code}:[/red] {e.response.text}")
        raise typer.Exit(1)

    mission_id = data.get("id") or data.get("mission_id")
    console.print(f"\n[green]✓[/green] Mission [bold]#{mission_id}[/bold] created")

    # Show task DAG if available.
    tasks = data.get("tasks", [])
    if tasks:
        table = Table(title="Task DAG", border_style="dim")
        table.add_column("#", style="dim")
        table.add_column("Agent", style="cyan")
        table.add_column("Task", style="white")
        table.add_column("Depends On", style="dim")
        table.add_column("Status")
        for t in tasks:
            deps = ", ".join(str(d) for d in t.get("depends_on", []))
            table.add_row(
                str(t.get("id", "")),
                t.get("agent_codename", ""),
                t.get("title", ""),
                deps or "—",
                status_text(t.get("status", "created")),
            )
        console.print(table)

    # Stream mission events.
    console.print(f"\n[dim]Streaming mission events (Ctrl+C to detach)...[/dim]\n")

    def on_mission_event(event):
        ts = timestamp_short(event.get("timestamp", ""))
        etype = event.get("type", "")
        payload = event.get("payload", {})
        source = event.get("source", "system")

        if etype == "task_update":
            status = payload.get("status", "")
            agent = payload.get("agent", source)
            title = payload.get("title", "")
            console.print(f"  [dim]{ts}[/dim]  {status_text(status)}  [cyan]{agent}[/cyan]  {title}")
        elif etype == "action_update":
            tool = payload.get("tool_name", "")
            console.print(f"  [dim]{ts}[/dim]  [dim]action[/dim]  [yellow]{tool}[/yellow]  {source}")
        elif etype == "tool_output":
            output = str(payload.get("output", ""))[:200]
            console.print(f"  [dim]{ts}[/dim]  [dim]output[/dim]  {output}")
        elif etype == "mission_update":
            status = payload.get("status", "")
            console.print(f"  [dim]{ts}[/dim]  [bold]MISSION {status_text(status)}[/bold]")
        else:
            console.print(f"  [dim]{ts}[/dim]  [dim]{etype}[/dim]  {json.dumps(payload)[:120]}")

    sse_url = f"{get_go_api_base()}/api/realtime/stream"
    stream_sse(sse_url, channel=f"mission:{mission_id}", on_event=on_mission_event)


@mission_app.command("list")
def mission_list(
    status: Optional[str] = typer.Option(None, "--status", "-s", help="Filter by status"),
    limit: int = typer.Option(20, "--limit", "-n"),
):
    """List missions."""
    base = get_api_base()
    params = {"limit": limit}
    if status:
        params["status"] = status

    try:
        resp = httpx.get(f"{base}/api/v2/missions", params=params, headers=api_headers(), timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except (httpx.ConnectError, httpx.HTTPStatusError) as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(1)

    missions = data if isinstance(data, list) else data.get("missions", data.get("items", []))

    table = Table(title="Missions", border_style="dim")
    table.add_column("ID", style="dim")
    table.add_column("Title", style="white", max_width=50)
    table.add_column("Type", style="cyan")
    table.add_column("Status")
    table.add_column("Target", style="dim")
    table.add_column("Created", style="dim")

    for m in missions:
        table.add_row(
            str(m.get("id", "")),
            m.get("title", ""),
            m.get("mission_type", ""),
            status_text(m.get("status", "")),
            m.get("target", "")[:30],
            timestamp_short(m.get("created_at", "")),
        )
    console.print(table)


@mission_app.command("cancel")
def mission_cancel(mission_id: int = typer.Argument(..., help="Mission ID to cancel")):
    """Cancel a running mission."""
    base = get_api_base()
    try:
        resp = httpx.post(
            f"{base}/api/v2/missions/{mission_id}/cancel",
            headers=api_headers(),
            timeout=15,
        )
        resp.raise_for_status()
        console.print(f"[green]✓[/green] Mission #{mission_id} cancelled")
    except (httpx.ConnectError, httpx.HTTPStatusError) as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(1)


# ═══════════════════════════════════════════════════════════════════════════
# T2: AGENT WATCH
# ═══════════════════════════════════════════════════════════════════════════

agents_app = typer.Typer(help="Agent management and live monitoring")
app.add_typer(agents_app, name="agents")


@agents_app.command("watch")
def agents_watch(
    agent: Optional[str] = typer.Option(None, "--agent", "-a", help="Filter by agent codename"),
    mission: Optional[int] = typer.Option(None, "--mission", "-m", help="Filter by mission ID"),
):
    """Live stream of all agent activity — tool calls, stdout/stderr, status changes."""
    console.print(Panel(
        f"[bold gold1]AGENT WATCH[/bold gold1]\n"
        f"[dim]Filter:[/dim] agent={agent or 'all'}  mission={mission or 'all'}\n"
        f"[dim]Ctrl+C to stop[/dim]",
        border_style="gold1",
    ))

    def on_agent_event(event):
        ts = timestamp_short(event.get("timestamp", ""))
        etype = event.get("type", "")
        source = event.get("source", "")
        payload = event.get("payload", {})

        # Filter by agent if specified.
        event_agent = payload.get("agent", payload.get("agentId", source))
        if agent and agent.lower() not in str(event_agent).lower():
            return

        # Filter by mission if specified.
        event_mission = payload.get("missionId", payload.get("mission_id"))
        if mission and event_mission and int(event_mission) != mission:
            return

        agent_label = f"[cyan]{event_agent}[/cyan]" if event_agent else "[dim]system[/dim]"

        if etype == "agent_status":
            status = payload.get("status", "")
            task = payload.get("currentTask", "")
            console.print(f"  [dim]{ts}[/dim]  {agent_label}  {status_text(status)}  {task}")
        elif etype == "command_output":
            output = str(payload.get("output", payload.get("data", "")))[:200]
            console.print(f"  [dim]{ts}[/dim]  {agent_label}  [dim]>[/dim] {escape(output)}")
        elif etype == "react_iteration":
            thought = payload.get("thought", "")[:100]
            action = payload.get("action", "")
            console.print(
                f"  [dim]{ts}[/dim]  {agent_label}  "
                f"[yellow]iter {payload.get('iteration', '?')}[/yellow]  "
                f"{escape(thought)}  [bold]→ {action}[/bold]"
            )
        elif etype == "tool_output":
            tool = payload.get("tool_name", "")
            output = str(payload.get("output", ""))[:150]
            console.print(f"  [dim]{ts}[/dim]  {agent_label}  [yellow]{tool}[/yellow]  {escape(output)}")
        elif etype == "action_update":
            tool = payload.get("tool_name", "")
            status = payload.get("status", "")
            console.print(f"  [dim]{ts}[/dim]  {agent_label}  [yellow]{tool}[/yellow]  {status_text(status)}")
        else:
            console.print(f"  [dim]{ts}[/dim]  {agent_label}  [dim]{etype}[/dim]")

    sse_url = f"{get_go_api_base()}/api/realtime/stream"
    stream_sse(sse_url, channel="agents", on_event=on_agent_event)


@agents_app.command("list")
def agents_list():
    """List all agents and their current status."""
    base = get_go_api_base()
    try:
        resp = httpx.get(f"{base}/api/agents", headers=api_headers(), timeout=15)
        resp.raise_for_status()
        agents = resp.json()
        if not isinstance(agents, list):
            agents = agents.get("agents", agents.get("items", []))
    except (httpx.ConnectError, httpx.HTTPStatusError) as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(1)

    table = Table(title="Agents", border_style="dim")
    table.add_column("ID", style="dim")
    table.add_column("Name", style="cyan")
    table.add_column("Type", style="white")
    table.add_column("Status")

    for a in agents:
        table.add_row(
            str(a.get("id", "")),
            a.get("name", ""),
            a.get("type", ""),
            status_text(a.get("status", "")),
        )
    console.print(table)


# ═══════════════════════════════════════════════════════════════════════════
# T3: FINDINGS STREAM
# ═══════════════════════════════════════════════════════════════════════════

findings_app = typer.Typer(help="Real-time findings feed")
app.add_typer(findings_app, name="findings")


@findings_app.command("stream")
def findings_stream(
    mission: Optional[int] = typer.Option(None, "--mission", "-m", help="Filter by mission ID"),
    severity: Optional[str] = typer.Option(None, "--severity", "-s", help="Min severity: info, low, medium, high, critical"),
):
    """Stream findings in real-time as agents discover them."""
    console.print(Panel(
        f"[bold gold1]FINDINGS FEED[/bold gold1]\n"
        f"[dim]Mission:[/dim] {mission or 'all'}  [dim]Min severity:[/dim] {severity or 'all'}\n"
        f"[dim]Ctrl+C to stop[/dim]",
        border_style="gold1",
    ))

    sev_order = ["info", "low", "medium", "high", "critical"]
    min_idx = sev_order.index(severity.lower()) if severity and severity.lower() in sev_order else 0

    def on_finding_event(event):
        payload = event.get("payload", {})
        etype = event.get("type", "")

        if etype != "finding" and etype != "system_alert":
            return

        finding_sev = payload.get("severity", "info").lower()
        if sev_order.index(finding_sev) if finding_sev in sev_order else 0 < min_idx:
            return

        event_mission = payload.get("mission_id")
        if mission and event_mission and int(event_mission) != mission:
            return

        ts = timestamp_short(event.get("timestamp", ""))
        host = payload.get("host", payload.get("target", ""))
        vuln = payload.get("title", payload.get("vuln", payload.get("message", "")))
        agent = payload.get("agent", event.get("source", ""))
        evidence = str(payload.get("evidence", ""))[:100]

        console.print(
            f"  [dim]{ts}[/dim]  "
            f"{severity_text(finding_sev)}  "
            f"[bold white]{escape(str(host))}[/bold white]  "
            f"{escape(str(vuln))}"
        )
        if agent:
            console.print(f"           [dim]agent:[/dim] [cyan]{agent}[/cyan]")
        if evidence:
            console.print(f"           [dim]evidence:[/dim] {escape(evidence)}")
        console.print()

    sse_url = f"{get_go_api_base()}/api/realtime/stream"
    stream_sse(sse_url, channel="findings", on_event=on_finding_event)


# ═══════════════════════════════════════════════════════════════════════════
# T4: WAR ROOM (simplified — full TUI in warroom.py)
# ═══════════════════════════════════════════════════════════════════════════

@app.command("warroom")
def warroom(
    mission: int = typer.Argument(..., help="Mission ID"),
):
    """Open the War Room TUI dashboard for a mission.

    Shows task graph, agent status, shared context. Inject commands to agents.
    """
    console.print(Panel(
        f"[bold gold1]WAR ROOM[/bold gold1] — Mission #{mission}\n"
        f"[dim]Task graph • Agent status • Live context[/dim]\n"
        f"[dim]Ctrl+C to exit[/dim]",
        border_style="gold1",
    ))

    # Fetch initial mission state.
    base = get_api_base()
    try:
        resp = httpx.get(f"{base}/api/v2/missions/{mission}", headers=api_headers(), timeout=15)
        resp.raise_for_status()
        mission_data = resp.json()
    except (httpx.ConnectError, httpx.HTTPStatusError) as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(1)

    # Display mission overview.
    console.print(f"\n  [bold]{mission_data.get('title', 'Unknown')}[/bold]")
    console.print(f"  Status: {status_text(mission_data.get('status', 'unknown'))}")
    console.print(f"  Target: {mission_data.get('target', 'N/A')}")
    console.print()

    # Fetch and display tasks.
    try:
        resp = httpx.get(f"{base}/api/v2/missions/{mission}/tasks", headers=api_headers(), timeout=15)
        resp.raise_for_status()
        tasks_data = resp.json()
        tasks = tasks_data if isinstance(tasks_data, list) else tasks_data.get("tasks", [])
    except Exception:
        tasks = []

    if tasks:
        table = Table(title="Task DAG", border_style="dim")
        table.add_column("#", style="dim")
        table.add_column("Agent", style="cyan")
        table.add_column("Task")
        table.add_column("Status")
        table.add_column("Deps", style="dim")
        for t in tasks:
            deps = ", ".join(str(d) for d in t.get("depends_on", []))
            table.add_row(
                str(t.get("id", t.get("position", ""))),
                t.get("agent_codename", ""),
                t.get("title", ""),
                status_text(t.get("status", "")),
                deps or "—",
            )
        console.print(table)

    # Stream events.
    console.print(f"\n[dim]Streaming war room events...[/dim]\n")

    def on_warroom_event(event):
        ts = timestamp_short(event.get("timestamp", ""))
        etype = event.get("type", "")
        payload = event.get("payload", {})
        source = event.get("source", "")

        if etype == "task_update":
            agent = payload.get("agent", source)
            status = payload.get("status", "")
            title = payload.get("title", "")
            console.print(f"  [dim]{ts}[/dim]  [cyan]{agent}[/cyan]  {status_text(status)}  {title}")
        elif etype == "system_alert":
            msg = payload.get("message", "")
            console.print(f"  [dim]{ts}[/dim]  [bold red]ALERT[/bold red]  {escape(str(msg))}")
        else:
            console.print(f"  [dim]{ts}[/dim]  [dim]{etype}[/dim]  {source}")

    sse_url = f"{get_go_api_base()}/api/realtime/stream"
    stream_sse(sse_url, channel=f"mission:{mission}", on_event=on_warroom_event)


# ═══════════════════════════════════════════════════════════════════════════
# T7: HEALING WATCH
# ═══════════════════════════════════════════════════════════════════════════

healing_app = typer.Typer(help="Self-healing monitor — container restarts, timeouts, stalls")
app.add_typer(healing_app, name="healing")


@healing_app.command("watch")
def healing_watch():
    """Live stream of self-healing events — container restarts, timeout kills, stall nudges."""
    console.print(Panel(
        f"[bold gold1]SELF-HEALING MONITOR[/bold gold1]\n"
        f"[dim]Container health • Timeout kills • Stall nudges • LLM diagnoses[/dim]\n"
        f"[dim]Ctrl+C to stop[/dim]",
        border_style="gold1",
    ))

    # Show current stats first.
    base = get_go_api_base()
    try:
        resp = httpx.get(f"{base}/api/healing/stats", headers=api_headers(), timeout=10)
        if resp.status_code == 200:
            stats = resp.json().get("stats", {})
            console.print(f"  [dim]Monitor:[/dim] {'[green]running[/green]' if stats.get('monitor_running') else '[red]stopped[/red]'}")
            console.print(f"  [dim]Total events:[/dim] {stats.get('total_events', 0)}")
            console.print(f"  [dim]Auto-fixed:[/dim] {stats.get('auto_fixed_count', 0)}")
            console.print(f"  [dim]Escalations:[/dim] {stats.get('escalation_count', 0)}")
            console.print(f"  [dim]Watching:[/dim] {stats.get('watched_containers', 0)} containers")
            console.print()
    except Exception:
        pass

    def on_healing_event(event):
        payload = event.get("payload", {})
        ts = timestamp_short(event.get("timestamp", ""))
        heal_type = payload.get("type", event.get("type", ""))
        severity = payload.get("severity", "info")
        title = payload.get("title", "")
        agent = payload.get("agent_codename", "")
        auto_fixed = payload.get("auto_fixed", False)
        fix_action = payload.get("fix_action", "")

        icon = HEAL_TYPE_ICONS.get(heal_type, "❓")
        fix_label = f"  [green]auto-fixed ({fix_action})[/green]" if auto_fixed else ""

        console.print(
            f"  [dim]{ts}[/dim]  {icon}  "
            f"{severity_text(severity)}  "
            f"{'[cyan]' + agent + '[/cyan]  ' if agent else ''}"
            f"{escape(str(title))}"
            f"{fix_label}"
        )

    sse_url = f"{get_go_api_base()}/api/realtime/stream"
    stream_sse(sse_url, channel="healing", on_event=on_healing_event)


@healing_app.command("status")
def healing_status():
    """Show healing monitor status and configuration."""
    base = get_go_api_base()
    try:
        resp = httpx.get(f"{base}/api/healing/status", headers=api_headers(), timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except (httpx.ConnectError, httpx.HTTPStatusError) as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(1)

    running = data.get("running", False)
    config = data.get("config", {})
    last_poll = data.get("last_poll_at", "never")

    console.print(Panel(
        f"[bold]Monitor:[/bold] {'[green]RUNNING[/green]' if running else '[red]STOPPED[/red]'}\n"
        f"[bold]Last poll:[/bold] {last_poll}\n\n"
        f"[bold]Configuration:[/bold]\n"
        f"  Poll interval:    {config.get('poll_interval_sec', '?')}s\n"
        f"  Subtask timeout:  {config.get('subtask_timeout_sec', '?')}s\n"
        f"  Stall threshold:  {config.get('stall_threshold_sec', '?')}s\n"
        f"  Max restarts:     {config.get('max_restart_retries', '?')}\n"
        f"  OOM memory limit: {config.get('oom_memory_limit_mb', '?')} MB\n"
        f"  Auto-heal:        {'[green]enabled[/green]' if config.get('auto_heal_enabled') else '[red]disabled[/red]'}\n"
        f"  LLM diagnosis:    {'[green]enabled[/green]' if config.get('llm_diag_enabled') else '[dim]disabled[/dim]'}",
        title="[gold1]Healing Monitor[/gold1]",
        border_style="gold1",
    ))


@healing_app.command("start")
def healing_start_cmd():
    """Start the healing monitor."""
    base = get_go_api_base()
    try:
        resp = httpx.post(f"{base}/api/healing/start", headers=api_headers(), timeout=10)
        resp.raise_for_status()
        console.print("[green]✓[/green] Healing monitor started")
    except (httpx.ConnectError, httpx.HTTPStatusError) as e:
        console.print(f"[red]Error:[/red] {e}")


@healing_app.command("stop")
def healing_stop_cmd():
    """Stop the healing monitor."""
    base = get_go_api_base()
    try:
        resp = httpx.post(f"{base}/api/healing/stop", headers=api_headers(), timeout=10)
        resp.raise_for_status()
        console.print("[green]✓[/green] Healing monitor stopped")
    except (httpx.ConnectError, httpx.HTTPStatusError) as e:
        console.print(f"[red]Error:[/red] {e}")


@healing_app.command("events")
def healing_events(
    limit: int = typer.Option(20, "--limit", "-n"),
    heal_type: Optional[str] = typer.Option(None, "--type", "-t", help="Filter: container_restart, oom_restart, timeout_kill, stall_nudge, escalation"),
    severity: Optional[str] = typer.Option(None, "--severity", "-s", help="Filter: info, warning, critical"),
):
    """List recent healing events."""
    base = get_go_api_base()
    params: dict = {"limit": limit}
    if heal_type:
        params["type"] = heal_type
    if severity:
        params["severity"] = severity

    try:
        resp = httpx.get(f"{base}/api/healing/events", params=params, headers=api_headers(), timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except (httpx.ConnectError, httpx.HTTPStatusError) as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(1)

    events = data.get("events", [])
    if not events:
        console.print("[dim]No healing events found.[/dim]")
        return

    table = Table(title=f"Healing Events ({data.get('total', len(events))} total)", border_style="dim")
    table.add_column("Time", style="dim")
    table.add_column("", style="white")  # icon
    table.add_column("Severity")
    table.add_column("Agent", style="cyan")
    table.add_column("Title", max_width=50)
    table.add_column("Fix", style="green")

    for evt in events:
        icon = HEAL_TYPE_ICONS.get(evt.get("type", ""), "")
        fix = evt.get("fix_action", "") if evt.get("auto_fixed") else ""
        table.add_row(
            timestamp_short(evt.get("created_at", "")),
            icon,
            severity_text(evt.get("severity", "info")),
            evt.get("agent_codename", ""),
            evt.get("title", ""),
            fix,
        )
    console.print(table)


# ═══════════════════════════════════════════════════════════════════════════
# T6: MEMORY SEARCH
# ═══════════════════════════════════════════════════════════════════════════

memory_app = typer.Typer(help="Query agent memory and knowledge graph")
app.add_typer(memory_app, name="memory")


@memory_app.command("search")
def memory_search(
    query: str = typer.Argument(..., help="Search query"),
    collection: Optional[str] = typer.Option(None, "--collection", "-c", help="Memory collection: guides, answers, code"),
    limit: int = typer.Option(10, "--limit", "-n"),
):
    """Semantic search across agent memory."""
    base = get_go_api_base()
    params: dict = {"query": query, "limit": limit}
    if collection:
        params["collection"] = collection

    try:
        resp = httpx.get(f"{base}/api/memory/search", params=params, headers=api_headers(), timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except (httpx.ConnectError, httpx.HTTPStatusError) as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(1)

    results = data.get("results", data.get("items", []))
    if not results:
        console.print("[dim]No results found.[/dim]")
        return

    for i, r in enumerate(results, 1):
        score = r.get("similarity", r.get("score", 0))
        content = r.get("content", "")[:200]
        coll = r.get("collection", "")
        console.print(f"  [bold]{i}.[/bold]  [dim]score={score:.2f}[/dim]  [cyan]{coll}[/cyan]")
        console.print(f"     {escape(content)}")
        console.print()


# ═══════════════════════════════════════════════════════════════════════════
# KILL SWITCH
# ═══════════════════════════════════════════════════════════════════════════

@app.command("kill")
def kill_switch():
    """Emergency kill switch — halt all agent operations immediately."""
    confirm = typer.confirm("⚠️  KILL SWITCH — This will halt ALL agent operations. Continue?")
    if not confirm:
        raise typer.Abort()

    base = get_go_api_base()
    try:
        resp = httpx.post(
            f"{base}/api/realtime/killswitch",
            json={"active": True},
            headers=api_headers(),
            timeout=10,
        )
        resp.raise_for_status()
        console.print("[bold red]⚠️  KILL SWITCH ACTIVATED[/bold red] — All operations halted")
    except (httpx.ConnectError, httpx.HTTPStatusError) as e:
        console.print(f"[red]Error:[/red] {e}")


# ═══════════════════════════════════════════════════════════════════════════
# VERSION
# ═══════════════════════════════════════════════════════════════════════════

@app.command("version")
def version():
    """Show Harbinger version."""
    console.print("[bold gold1]Harbinger[/bold gold1] v2.0.0 — Autonomous Security Operating System")


# ── Entry point ─────────────────────────────────────────────────────────────

def main():
    # Graceful Ctrl+C.
    signal.signal(signal.SIGINT, lambda *_: sys.exit(0))
    app()


if __name__ == "__main__":
    main()
