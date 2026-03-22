"""
harbinger ingest — Bulk-load knowledge into Harbinger's memory system.

Commands:
  harbinger ingest file report.pdf
  harbinger ingest dir ./recon-data/
  harbinger ingest scan nuclei-results.jsonl --tool nuclei
  harbinger ingest mockhunter ./project/
  harbinger ingest url https://example.com/advisory
"""

import asyncio
from pathlib import Path

import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

ingest_app = typer.Typer(help="Ingest knowledge into Harbinger memory")
console = Console()


def _run_async(coro):
    """Run an async function from sync typer context."""
    return asyncio.get_event_loop().run_until_complete(coro)


@ingest_app.command("file")
def ingest_file_cmd(
    path: str = typer.Argument(..., help="Path to file"),
    collection: str = typer.Option("general", "--collection", "-c", help="Memory collection"),
    format: str = typer.Option(None, "--format", "-f", help="Format hint: text, jsonl, mockhunter"),
    mission: str = typer.Option("", "--mission", "-m", help="Associate with mission ID"),
):
    """Ingest a single file into memory."""
    p = Path(path)
    if not p.exists():
        console.print(f"[red]File not found: {path}[/]")
        raise typer.Exit(1)

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), console=console) as progress:
        progress.add_task(f"Ingesting {p.name}...", total=None)

        from src.memory.ingest import ingest_file
        result = _run_async(ingest_file(path, collection=collection, format_hint=format, mission_id=mission))

    console.print(f"[green]Done![/] {result.chunks_stored} chunks stored, "
                  f"{result.entities_extracted} entities extracted, "
                  f"{result.graph_nodes_created} graph nodes")
    if result.errors:
        console.print(f"[yellow]Warnings: {len(result.errors)}[/]")
        for err in result.errors[:5]:
            console.print(f"  [dim]{err}[/]")


@ingest_app.command("dir")
def ingest_dir_cmd(
    path: str = typer.Argument(..., help="Directory path"),
    collection: str = typer.Option("general", "--collection", "-c"),
    recursive: bool = typer.Option(True, "--recursive/--no-recursive", "-r"),
    extensions: str = typer.Option(None, "--ext", help="Comma-separated extensions (.md,.txt,.json)"),
    mission: str = typer.Option("", "--mission", "-m"),
):
    """Recursively ingest all files in a directory."""
    p = Path(path)
    if not p.is_dir():
        console.print(f"[red]Not a directory: {path}[/]")
        raise typer.Exit(1)

    ext_set = None
    if extensions:
        ext_set = {e.strip() if e.startswith(".") else f".{e.strip()}" for e in extensions.split(",")}

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), console=console) as progress:
        progress.add_task(f"Ingesting {p.name}/...", total=None)

        from src.memory.ingest import ingest_directory
        result = _run_async(ingest_directory(
            path, collection=collection, extensions=ext_set,
            mission_id=mission, recursive=recursive,
        ))

    console.print(f"[green]Done![/] {len(result.sources)} files, "
                  f"{result.chunks_stored} chunks, "
                  f"{result.entities_extracted} entities, "
                  f"{result.graph_nodes_created} graph nodes")
    if result.errors:
        console.print(f"[yellow]{len(result.errors)} errors[/]")


@ingest_app.command("scan")
def ingest_scan_cmd(
    path: str = typer.Argument(..., help="Path to JSONL scan output"),
    tool: str = typer.Option("unknown", "--tool", "-t", help="Tool name: nuclei, httpx, subfinder"),
    collection: str = typer.Option("answer", "--collection", "-c"),
    mission: str = typer.Option("", "--mission", "-m"),
):
    """Ingest security tool scan output (JSONL format)."""
    p = Path(path)
    if not p.exists():
        console.print(f"[red]File not found: {path}[/]")
        raise typer.Exit(1)

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), console=console) as progress:
        progress.add_task(f"Ingesting {tool} output...", total=None)

        from src.memory.ingest import ingest_scan_output
        result = _run_async(ingest_scan_output(path, tool_name=tool, collection=collection, mission_id=mission))

    console.print(f"[green]Done![/] {result.chunks_stored} findings ingested, "
                  f"{result.entities_extracted} entities, "
                  f"{result.graph_nodes_created} graph nodes")


@ingest_app.command("mockhunter")
def ingest_mockhunter_cmd(
    path: str = typer.Argument(".", help="Target path to scan"),
    collection: str = typer.Option("code", "--collection", "-c"),
    mission: str = typer.Option("", "--mission", "-m"),
):
    """Run MockHunter on a path and ingest findings into memory."""
    p = Path(path)
    if not p.exists():
        console.print(f"[red]Path not found: {path}[/]")
        raise typer.Exit(1)

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), console=console) as progress:
        progress.add_task(f"Running MockHunter on {p.name}...", total=None)

        from src.memory.ingest import ingest_mockhunter
        result = _run_async(ingest_mockhunter(path, collection=collection, mission_id=mission))

    console.print(f"[green]Done![/] {result.chunks_stored} findings ingested, "
                  f"{result.entities_extracted} entities")
    if result.errors:
        for err in result.errors:
            console.print(f"  [yellow]{err}[/]")
