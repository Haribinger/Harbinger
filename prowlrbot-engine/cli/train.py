"""
harbinger train — Local model fine-tuning and training for Harbinger agents.

Supports:
  - LoRA/QLoRA fine-tuning of local models via Ollama + unsloth
  - Dataset generation from ingested memory (Q&A pairs, agent traces)
  - Export training datasets in JSONL/ShareGPT format
  - Model evaluation against security benchmarks

Architecture:
  Harbinger agents use litellm for LLM calls, which routes to Ollama for local
  models. Training produces LoRA adapters that Ollama can hot-load. The loop:
    1. Agents run missions → tool calls + results stored in memory
    2. `harbinger train export` extracts training pairs from memory
    3. `harbinger train finetune` runs LoRA training via unsloth
    4. `harbinger train deploy` pushes the adapter to Ollama
    5. Agent config updated to use fine-tuned model

Model recommendations for security tasks:
  - qwen2.5-coder:7b  — best for code analysis, exploit dev (SAM, CIPHER)
  - llama3.1:8b        — general reasoning, recon planning (PATHFINDER, ORCHESTRATOR)
  - mistral:7b         — fast inference, good for high-volume scanning (BREACH)
  - phi3:mini          — ultra-light, good for simple classification (SCRIBE)
"""

import asyncio
import json
import os
import subprocess
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

train_app = typer.Typer(help="Train and fine-tune local models for Harbinger agents")
console = Console()


def _run_async(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ── Export training data from memory ─────────────────────────────────────────

@train_app.command("export")
def train_export(
    output: str = typer.Argument("training_data.jsonl", help="Output JSONL file"),
    collection: str = typer.Option(None, "--collection", "-c", help="Filter by collection"),
    agent: str = typer.Option(None, "--agent", "-a", help="Filter by agent"),
    format: str = typer.Option("sharegpt", "--format", "-f", help="Format: sharegpt, alpaca, raw"),
    limit: int = typer.Option(10000, "--limit", "-l", help="Max samples"),
):
    """Export training dataset from Harbinger's memory.

    Extracts Q&A pairs, agent traces, and tool call sequences from the vector
    memory store and formats them for fine-tuning.

    Formats:
      sharegpt — [{conversations: [{from: human, value: ...}, {from: gpt, value: ...}]}]
      alpaca   — [{instruction: ..., input: ..., output: ...}]
      raw      — [{query: ..., response: ..., metadata: ...}]
    """
    from cli.client import api_get

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), console=console) as progress:
        progress.add_task("Exporting training data from memory...", total=None)

        # Fetch memories via API
        params = {"limit": limit}
        if collection:
            params["collection"] = collection
        if agent:
            params["agent_id"] = agent

        data = api_get("/api/v2/memory/search", params={"query": "*", **params})
        results = data if isinstance(data, list) else data.get("results", [])

    if not results:
        console.print("[yellow]No data found in memory. Ingest some data first:[/]")
        console.print("  harbinger ingest file report.md")
        console.print("  harbinger ingest scan nuclei-results.jsonl --tool nuclei")
        return

    # Convert to training format
    samples = []
    for item in results:
        content = item.get("content", "")
        meta = item.get("metadata", {})

        if format == "sharegpt":
            samples.append({
                "conversations": [
                    {"from": "human", "value": _generate_question(content, meta)},
                    {"from": "gpt", "value": content},
                ],
            })
        elif format == "alpaca":
            samples.append({
                "instruction": _generate_question(content, meta),
                "input": meta.get("source", ""),
                "output": content,
            })
        else:  # raw
            samples.append({
                "query": _generate_question(content, meta),
                "response": content,
                "metadata": meta,
            })

    out_path = Path(output)
    with out_path.open("w") as f:
        for sample in samples:
            f.write(json.dumps(sample) + "\n")

    console.print(f"[green]Exported {len(samples)} training samples to {output}[/]")
    console.print(f"  Format: {format}")
    console.print(f"  Size: {out_path.stat().st_size / 1024:.1f} KB")


def _generate_question(content: str, metadata: dict) -> str:
    """Generate a training question from content and metadata."""
    tool = metadata.get("tool", "")
    category = metadata.get("category", "")
    severity = metadata.get("severity", "")

    if tool == "nuclei":
        return f"Analyze this {severity} vulnerability finding and explain the impact."
    elif tool == "mockhunter":
        return f"Review this {category} code quality issue and suggest a fix."
    elif tool in ("httpx", "subfinder"):
        return f"Analyze this {tool} reconnaissance result."
    elif category:
        return f"Explain this {category} security finding."
    else:
        # Use first line as a pseudo-question
        first_line = content.split("\n")[0][:100]
        return f"Explain: {first_line}"


# ── Fine-tune via unsloth + Ollama ───────────────────────────────────────────

@train_app.command("finetune")
def train_finetune(
    dataset: str = typer.Argument(..., help="Training dataset (JSONL)"),
    base_model: str = typer.Option("qwen2.5-coder:7b", "--model", "-m", help="Base model from Ollama"),
    output_name: str = typer.Option(None, "--output", "-o", help="Output model name"),
    epochs: int = typer.Option(3, "--epochs", "-e", help="Training epochs"),
    batch_size: int = typer.Option(4, "--batch-size", "-b", help="Batch size"),
    lora_r: int = typer.Option(16, "--lora-r", help="LoRA rank"),
    lora_alpha: int = typer.Option(32, "--lora-alpha", help="LoRA alpha"),
    learning_rate: float = typer.Option(2e-4, "--lr", help="Learning rate"),
    use_qlora: bool = typer.Option(True, "--qlora/--no-qlora", help="Use 4-bit QLoRA"),
):
    """Fine-tune a local model using LoRA/QLoRA.

    Prerequisites:
      pip install unsloth torch transformers datasets trl
      ollama pull qwen2.5-coder:7b

    The workflow:
      1. Pulls base model weights from Ollama or HuggingFace
      2. Applies LoRA adapters and trains on your dataset
      3. Exports merged GGUF model
      4. Creates Ollama Modelfile and registers the model

    After training:
      harbinger train deploy my-model
      Then update agent config to use "my-model" instead of the base.
    """
    dataset_path = Path(dataset)
    if not dataset_path.exists():
        console.print(f"[red]Dataset not found: {dataset}[/]")
        raise typer.Exit(1)

    if output_name is None:
        output_name = f"harbinger-{base_model.split(':')[0].replace('/', '-')}"

    console.print(f"[yellow]Fine-tuning {base_model} → {output_name}[/]")
    console.print(f"  Dataset: {dataset} ({dataset_path.stat().st_size / 1024:.1f} KB)")
    console.print(f"  LoRA: r={lora_r}, alpha={lora_alpha}, {'QLoRA 4-bit' if use_qlora else 'LoRA 16-bit'}")
    console.print(f"  Training: {epochs} epochs, batch={batch_size}, lr={learning_rate}")
    console.print()

    # Generate the training script
    script = _generate_training_script(
        dataset=str(dataset_path.resolve()),
        base_model=base_model,
        output_name=output_name,
        epochs=epochs,
        batch_size=batch_size,
        lora_r=lora_r,
        lora_alpha=lora_alpha,
        learning_rate=learning_rate,
        use_qlora=use_qlora,
    )

    script_path = Path(f"/tmp/harbinger_train_{output_name}.py")
    script_path.write_text(script)

    console.print(f"[dim]Training script written to {script_path}[/]")
    console.print("[yellow]Starting training...[/]")
    console.print()

    try:
        proc = subprocess.run(
            ["python", str(script_path)],
            cwd="/tmp",
            timeout=3600 * 4,  # 4 hour timeout
        )
        if proc.returncode != 0:
            console.print(f"[red]Training failed with exit code {proc.returncode}[/]")
            raise typer.Exit(1)
    except FileNotFoundError:
        console.print("[red]Python not found. Ensure unsloth is installed:[/]")
        console.print("  pip install unsloth torch transformers datasets trl")
        raise typer.Exit(1)
    except subprocess.TimeoutExpired:
        console.print("[red]Training timed out after 4 hours[/]")
        raise typer.Exit(1)

    console.print(f"\n[green]Training complete! Model saved as {output_name}[/]")
    console.print(f"  Deploy with: harbinger train deploy {output_name}")


def _generate_training_script(
    dataset: str,
    base_model: str,
    output_name: str,
    epochs: int,
    batch_size: int,
    lora_r: int,
    lora_alpha: int,
    learning_rate: float,
    use_qlora: bool,
) -> str:
    """Generate a self-contained Python training script using unsloth."""
    quantization = "load_in_4bit=True," if use_qlora else ""
    return f'''#!/usr/bin/env python3
"""Auto-generated Harbinger training script — {output_name}"""
import json
from pathlib import Path

try:
    from unsloth import FastLanguageModel
except ImportError:
    print("ERROR: unsloth not installed. Run: pip install unsloth")
    exit(1)

from datasets import Dataset
from trl import SFTTrainer
from transformers import TrainingArguments

# ── Load base model ──────────────────────────────────────────────────────
print(f"Loading base model: {base_model}")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="{base_model}",
    max_seq_length=4096,
    {quantization}
)

# ── Apply LoRA ───────────────────────────────────────────────────────────
model = FastLanguageModel.get_peft_model(
    model,
    r={lora_r},
    lora_alpha={lora_alpha},
    lora_dropout=0.05,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                     "gate_proj", "up_proj", "down_proj"],
    bias="none",
    use_gradient_checkpointing="unsloth",
)

# ── Load dataset ─────────────────────────────────────────────────────────
print(f"Loading dataset: {dataset}")
samples = []
with open("{dataset}") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        item = json.loads(line)
        # Handle ShareGPT format
        if "conversations" in item:
            convos = item["conversations"]
            text = ""
            for turn in convos:
                role = "### Human:" if turn["from"] == "human" else "### Assistant:"
                text += f"{{role}}\\n{{turn['value']}}\\n\\n"
            samples.append({{"text": text.strip()}})
        # Handle Alpaca format
        elif "instruction" in item:
            text = f"### Instruction:\\n{{item['instruction']}}\\n\\n"
            if item.get("input"):
                text += f"### Input:\\n{{item['input']}}\\n\\n"
            text += f"### Response:\\n{{item['output']}}"
            samples.append({{"text": text}})
        else:
            samples.append({{"text": json.dumps(item)}})

dataset = Dataset.from_list(samples)
print(f"Dataset: {{len(samples)}} samples")

# ── Train ────────────────────────────────────────────────────────────────
trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    args=TrainingArguments(
        output_dir="/tmp/harbinger-lora-{output_name}",
        num_train_epochs={epochs},
        per_device_train_batch_size={batch_size},
        learning_rate={learning_rate},
        weight_decay=0.01,
        warmup_steps=10,
        logging_steps=5,
        save_steps=100,
        fp16=True,
        report_to="none",
    ),
    dataset_text_field="text",
    max_seq_length=4096,
)

print("Training...")
trainer.train()
print("Training complete!")

# ── Export to GGUF ───────────────────────────────────────────────────────
output_dir = Path("/tmp/harbinger-models/{output_name}")
output_dir.mkdir(parents=True, exist_ok=True)

print(f"Saving merged model to {{output_dir}}")
model.save_pretrained_gguf(
    str(output_dir),
    tokenizer,
    quantization_method="q4_k_m",
)

# ── Create Ollama Modelfile ──────────────────────────────────────────────
gguf_files = list(output_dir.glob("*.gguf"))
if gguf_files:
    modelfile = output_dir / "Modelfile"
    modelfile.write_text(f"""FROM {{gguf_files[0].name}}
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER stop "### Human:"
PARAMETER stop "### Instruction:"

SYSTEM You are a Harbinger security agent. You analyze targets, execute reconnaissance, identify vulnerabilities, and report findings with precision. Always include evidence and severity ratings.
""")
    print(f"Modelfile written to {{modelfile}}")
    print(f"\\nTo deploy: ollama create {output_name} -f {{modelfile}}")
else:
    print("WARNING: No GGUF file produced — manual conversion needed")

print("\\nDone! Next steps:")
print(f"  1. ollama create {output_name} -f {{output_dir}}/Modelfile")
print(f"  2. harbinger train deploy {output_name}")
print(f"  3. Update agent config: model = \\"{output_name}\\"")
'''


# ── Deploy to Ollama ─────────────────────────────────────────────────────────

@train_app.command("deploy")
def train_deploy(
    model_name: str = typer.Argument(..., help="Model name to deploy"),
    model_dir: str = typer.Option(None, "--dir", "-d", help="Model directory (default: /tmp/harbinger-models/{name})"),
):
    """Deploy a trained model to Ollama.

    Registers the GGUF model with Ollama so agents can use it via litellm.
    """
    if model_dir is None:
        model_dir = f"/tmp/harbinger-models/{model_name}"

    model_path = Path(model_dir)
    modelfile = model_path / "Modelfile"

    if not modelfile.exists():
        console.print(f"[red]Modelfile not found at {modelfile}[/]")
        console.print("Run `harbinger train finetune` first")
        raise typer.Exit(1)

    console.print(f"[yellow]Deploying {model_name} to Ollama...[/]")

    try:
        proc = subprocess.run(
            ["ollama", "create", model_name, "-f", str(modelfile)],
            cwd=str(model_path),
            capture_output=True,
            text=True,
            timeout=300,
        )
        if proc.returncode != 0:
            console.print(f"[red]Ollama create failed: {proc.stderr}[/]")
            raise typer.Exit(1)

        console.print(f"[green]Model {model_name} deployed to Ollama![/]")
        console.print(f"\nTest it: ollama run {model_name} 'What is SQL injection?'")
        console.print(f"Use in Harbinger: set agent model to '{model_name}'")

    except FileNotFoundError:
        console.print("[red]Ollama not found. Install: curl -fsSL https://ollama.com/install.sh | sh[/]")
        raise typer.Exit(1)


# ── List available models ────────────────────────────────────────────────────

@train_app.command("models")
def train_models():
    """List available models in Ollama."""
    try:
        proc = subprocess.run(
            ["ollama", "list"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if proc.returncode != 0:
            console.print("[red]Failed to list Ollama models[/]")
            return

        lines = proc.stdout.strip().split("\n")
        if len(lines) < 2:
            console.print("[dim]No models installed. Pull one:[/]")
            console.print("  ollama pull qwen2.5-coder:7b")
            return

        table = Table(title="Ollama Models", border_style="dim")
        table.add_column("Name", style="cyan")
        table.add_column("Size", width=10)
        table.add_column("Modified", width=20)

        for line in lines[1:]:  # skip header
            parts = line.split()
            if len(parts) >= 3:
                name = parts[0]
                # Highlight Harbinger models
                style = "green bold" if name.startswith("harbinger") else "cyan"
                table.add_row(f"[{style}]{name}[/]", parts[1] if len(parts) > 2 else "", " ".join(parts[2:4]) if len(parts) > 3 else "")

        console.print(table)

    except FileNotFoundError:
        console.print("[red]Ollama not installed[/]")
        console.print("  Install: curl -fsSL https://ollama.com/install.sh | sh")


# ── Benchmark a model ────────────────────────────────────────────────────────

@train_app.command("bench")
def train_bench(
    model: str = typer.Argument(..., help="Model to benchmark"),
    prompts: str = typer.Option(None, "--prompts", "-p", help="Custom prompts file (JSONL)"),
):
    """Benchmark a model against security knowledge prompts.

    Tests the model on common security tasks: vuln analysis, recon planning,
    exploit explanation, report writing. Measures response quality and latency.
    """
    import time

    default_prompts = [
        {"task": "vuln_analysis", "prompt": "A nuclei scan found CVE-2024-3400 (critical) on a Palo Alto GlobalProtect gateway at vpn.target.com. Explain the vulnerability, its impact, and recommended remediation steps."},
        {"task": "recon_planning", "prompt": "Plan a reconnaissance strategy for the domain target.com. List the tools you would use, in what order, and what information each provides."},
        {"task": "exploit_explain", "prompt": "Explain how SQL injection works in a PHP application using parameterized queries vs string concatenation. Include a proof-of-concept payload."},
        {"task": "report_writing", "prompt": "Write a vulnerability report for: XSS in the search parameter of https://target.com/search?q=<script>alert(1)</script>. Include severity, impact, and remediation."},
        {"task": "code_review", "prompt": "Review this Go code for security issues:\nfunc handleLogin(w http.ResponseWriter, r *http.Request) {\n  user := r.FormValue(\"user\")\n  pass := r.FormValue(\"pass\")\n  db.Exec(\"SELECT * FROM users WHERE name='\" + user + \"' AND pass='\" + pass + \"'\")\n}"},
    ]

    if prompts:
        p = Path(prompts)
        if p.exists():
            custom = []
            for line in p.read_text().strip().split("\n"):
                if line.strip():
                    custom.append(json.loads(line))
            default_prompts = custom

    ollama_url = os.environ.get("OLLAMA_URL", "http://localhost:11434")

    console.print(f"[yellow]Benchmarking {model} ({len(default_prompts)} prompts)...[/]\n")

    import httpx

    results = []
    for i, item in enumerate(default_prompts):
        task = item.get("task", f"prompt_{i}")
        prompt = item["prompt"]

        console.print(f"  [{i+1}/{len(default_prompts)}] {task}...", end=" ")

        start = time.time()
        try:
            resp = httpx.post(
                f"{ollama_url}/api/generate",
                json={"model": model, "prompt": prompt, "stream": False},
                timeout=120.0,
            )
            elapsed = time.time() - start
            data = resp.json()
            response = data.get("response", "")
            tokens = data.get("eval_count", len(response.split()))
            tps = tokens / elapsed if elapsed > 0 else 0

            results.append({
                "task": task,
                "latency": round(elapsed, 2),
                "tokens": tokens,
                "tps": round(tps, 1),
                "response_len": len(response),
            })
            console.print(f"[green]{elapsed:.1f}s[/] ({tokens} tok, {tps:.0f} t/s)")

        except Exception as exc:
            console.print(f"[red]FAIL: {exc}[/]")
            results.append({"task": task, "latency": -1, "error": str(exc)})

    # Summary
    console.print()
    table = Table(title=f"Benchmark: {model}", border_style="dim")
    table.add_column("Task", style="cyan")
    table.add_column("Latency", width=10)
    table.add_column("Tokens", width=8)
    table.add_column("tok/s", width=8)

    for r in results:
        if r.get("error"):
            table.add_row(r["task"], "[red]FAIL[/]", "—", "—")
        else:
            table.add_row(
                r["task"],
                f"{r['latency']}s",
                str(r.get("tokens", "?")),
                str(r.get("tps", "?")),
            )

    console.print(table)

    avg_latency = sum(r["latency"] for r in results if r.get("latency", -1) > 0) / max(1, len([r for r in results if r.get("latency", -1) > 0]))
    console.print(f"\n  Average latency: {avg_latency:.1f}s")
