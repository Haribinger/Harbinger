# SAGE — Tool Arsenal

> Every tool listed here is installed in your Docker container and ready to use.

## Tool Philosophy

Analyze before changing. Measure before and after. Document everything. Your tools exist to understand systems deeply enough to improve them safely.

## Primary Tools

### Analysis Tools

#### jq / yq
- **Purpose:** JSON and YAML processing for config analysis
- **Category:** Analysis — Data Processing
```bash
# Parse agent configs
yq '.capabilities' /agents/recon-scout/CONFIG.yaml
cat findings.json | jq '.[] | select(.severity == "critical")'
yq -i '.heartbeat.enabled = true' CONFIG.yaml
```

#### diff / colordiff
- **Purpose:** Show changes between files or versions
- **Category:** Analysis — Change Tracking
```bash
diff -u old-config.yaml new-config.yaml
colordiff -u before.md after.md
diff -rq /workspace/v1/ /workspace/v2/
```

#### git
- **Purpose:** Version control for tracking all changes
- **Category:** Analysis — Version Control
```bash
git diff HEAD~1
git log --oneline --since="24 hours ago"
git blame CONFIG.yaml
git show HEAD:agents/recon-scout/CONFIG.yaml  # previous version
```

### Code Quality Tools

#### eslint / prettier
- **Purpose:** JavaScript/TypeScript linting and formatting
- **Category:** Optimization — Code Quality
```bash
eslint src/ --format json --output-file lint-report.json
prettier --check "src/**/*.{ts,tsx}"
prettier --write "src/**/*.{ts,tsx}"
```

#### gofmt / go vet
- **Purpose:** Go formatting and static analysis
- **Category:** Optimization — Code Quality
```bash
gofmt -l ./backend/
go vet ./backend/...
```

#### black / ruff
- **Purpose:** Python formatting and linting
- **Category:** Optimization — Code Quality
```bash
black --check scripts/
ruff check scripts/ --fix
```

### Documentation Tools

#### pandoc
- **Purpose:** Document generation for change reports
- **Category:** Documentation — Report Generation
```bash
pandoc improvement-report.md -o report.pdf
pandoc improvement-report.md -o report.html --self-contained
```

#### mermaid-cli
- **Purpose:** Diagram generation for architecture docs
- **Category:** Documentation — Diagrams
```bash
mmdc -i architecture.mmd -o architecture.png -t dark
```

### System Analysis

#### time / hyperfine
- **Purpose:** Performance measurement for before/after benchmarks
- **Category:** Analysis — Performance
```bash
time ./tool-before arg1
time ./tool-after arg1
hyperfine './tool-before arg1' './tool-after arg1'
```

#### wc / sort / uniq
- **Purpose:** Log analysis and pattern counting
- **Category:** Analysis — Log Processing
```bash
cat agent.log | grep ERROR | sort | uniq -c | sort -rn
wc -l /workspace/output/*.json
```

### Scripting

#### bash / python3 / node
- **Purpose:** Automation scripts for improvements
- **Category:** Automation — Scripting
```bash
python3 analyze-performance.py --since 24h
node generate-skill.js --template recon
bash optimize-dockerfiles.sh
```

## Docker Tools

```bash
# Analyze agent container sizes
curl {{HARBINGER_API}}/api/docker/containers

# Test optimized Dockerfile
curl -X POST {{HARBINGER_API}}/api/docker/containers \
  -d '{"image": "harbinger/optimized-agent:test", "cmd": "echo test", "auto_remove": true}'

curl {{HARBINGER_API}}/api/docker/containers
```

## Harbinger API Access

```bash
# Get all agent statuses for analysis
curl {{HARBINGER_API}}/api/agents

# Get performance metrics
curl "{{HARBINGER_API}}/api/agents/metrics?since=24h"

# Send improvement summary to BRIEF
curl -X POST {{HARBINGER_API}}/api/agents/broadcast \
  -d '{"from": "sage", "message": "Overnight improvement: optimized recon pipeline (30% faster)", "priority": "info"}'

# Update memory
curl -X POST {{HARBINGER_API}}/api/agents/context \
  -d '{"key": "recon_optimization", "value": "pipeline_v2", "source": "sage"}'
```
