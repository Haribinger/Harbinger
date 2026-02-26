# SAM — Tool Arsenal

> Every tool listed here is installed in your Docker container and ready to use.

## Tool Philosophy

Use the right tool for the job. TypeScript for frontend and rapid prototyping. Go for performant CLI tools and backends. Python for scripts and automation. Rust for security-critical components. The toolchain should never be a bottleneck.

## Language Toolchains

### TypeScript / JavaScript
```bash
# Package management
pnpm install
pnpm add <package>
pnpm build

# TypeScript compilation
tsc --noEmit                     # type check only
tsc -w                            # watch mode
tsx script.ts                     # run directly

# Linting and formatting
eslint src/ --fix
prettier --write "src/**/*.{ts,tsx}"

# Testing
vitest run
vitest --coverage
jest --watchAll
```

### Go
```bash
# Build and run
go build -o /tmp/tool ./cmd/
go run ./cmd/main.go
go install ./...

# Testing
go test ./...
go test -v -cover ./...
go test -race ./...

# Linting and formatting
gofmt -w .
go vet ./...
staticcheck ./...
golint ./...

# Debugging
dlv debug ./cmd/main.go
dlv test ./pkg/...
```

### Python
```bash
# Package management
pip install -r requirements.txt
poetry install
pip install <package>

# Linting and formatting
black .
ruff check . --fix
pylint src/
mypy src/ --strict

# Testing
pytest -v
pytest --cov=src
python -m pytest tests/ -x
```

### Rust
```bash
# Build and run
cargo build --release
cargo run
cargo install --path .

# Testing
cargo test
cargo test -- --nocapture

# Linting and formatting
rustfmt --edition 2021 src/**/*.rs
cargo clippy -- -D warnings
```

### C / C++
```bash
# Compilation
gcc -Wall -Wextra -o tool tool.c
gcc -g -fsanitize=address -o tool_debug tool.c

# Debugging
gdb ./tool
valgrind --leak-check=full ./tool

# Build systems
make
cmake -B build && cmake --build build
```

## General Tools

### git
```bash
git status
git diff
git log --oneline -20
git branch -a
git stash
git rebase -i HEAD~3
```

### docker
```bash
docker build -t harbinger/tool:latest .
docker run --rm harbinger/tool:latest
docker compose up -d
```

### curl / jq
```bash
curl -s http://localhost:8080/api/health | jq
curl -X POST http://localhost:8080/api/agents -d '{"name":"test"}' -H "Content-Type: application/json"
```

### ripgrep (rg)
```bash
rg "function_name" --type ts
rg "TODO|FIXME|HACK" -g "*.go"
rg "api/v1" --type-add 'web:*.{ts,tsx,js}' -t web
```

## Docker Tools

```bash
# Spawn build container
curl -X POST {{HARBINGER_API}}/api/docker/containers \
  -d '{"image": "golang:1.24", "cmd": "go build -o /output/tool ./cmd/", "auto_remove": true}'

# Run test suite in isolation
curl -X POST {{HARBINGER_API}}/api/docker/containers \
  -d '{"image": "harbinger/coding-agent", "cmd": "pnpm test", "auto_remove": true}'

# Spin up dev server
curl -X POST {{HARBINGER_API}}/api/docker/containers \
  -d '{"image": "harbinger/coding-agent", "cmd": "pnpm dev", "auto_remove": false}'

curl {{HARBINGER_API}}/api/docker/containers
```

## Harbinger API Access

```bash
# Test API endpoint
curl {{HARBINGER_API}}/api/health

# Check agent status
curl {{HARBINGER_API}}/api/agents

# Report completed tool
curl -X POST {{HARBINGER_API}}/api/agents/broadcast \
  -d '{"from": "sam", "message": "New tool deployed: custom-parser v1.0", "priority": "info"}'
```
