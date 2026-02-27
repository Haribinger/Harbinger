# Contributing to Harbinger

Harbinger welcomes contributions from security researchers, tool authors, and Go/React engineers.

## Before You Start

1. **Read `CLAUDE.md`** — it defines rules that must not be broken
2. **Read `ARCHITECTURE.md`** — understand the system design
3. **Use pnpm** — never npm or yarn
4. **Dark theme only** — Obsidian Command design system
5. **No placeholder code** — everything must be production-ready

## Development Setup

```bash
git clone https://github.com/Haribinger/Harbinger.git
cd harbinger
pnpm install

# Backend
cd backend && go run ./cmd/

# Frontend (separate terminal)
pnpm dev
```

## Code Style

### TypeScript (Frontend)
- Strict mode, functional components with hooks
- Zustand for state management — no Redux, no Context abuse
- Monospace fonts, Obsidian Command colors
- No `any` types without justification
- No console.log in production code (use console.error/warn for real errors)

### Go (Backend)
- Standard `gofmt` formatting
- Error handling required — no ignored errors
- Dual route registration: `/api/` and `/api/v1/`
- Auth middleware on all non-public routes
- No-Crash Policy: return `{ok:false, reason:"..."}` instead of 500

### CSS / Design
- Background: `#0a0a0f` — never white or light
- Accent: `#f0c040` — gold for interactive elements
- Borders: `#1a1a2e` — subtle dividers
- Font: `JetBrains Mono, Fira Code, monospace`
- No chat bubbles, no typing animations, no rounded corners on data panels

## Branching

```
main                    ← production-ready code
feature/{name}          ← new features
fix/{name}              ← bug fixes
docs/{name}             ← documentation updates
agent/{name}            ← new agent profiles
```

## Commit Messages

Format: `type(scope): description`

```
feat(frontend): add scope manager page
fix(backend): handle nil pointer in heartbeat
docs(agents): complete MAINTAINER profile
refactor(frontend): extract settings sections
chore(ci): add PR health check workflow
```

Types: `feat`, `fix`, `docs`, `refactor`, `style`, `test`, `chore`, `perf`, `ci`
Scopes: `backend`, `frontend`, `agents`, `skills`, `ci`, `docker`, `mcp`

## Pull Request Process

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Ensure builds pass:
   ```bash
   cd backend && go build -o /dev/null ./cmd/
   pnpm build:ui
   ```
5. Open a PR with the template filled out
6. Wait for review

## Adding a New Feature

Follow the scaffold order:
1. **Types** — `harbinger-tools/frontend/src/types/`
2. **Backend handler** — `backend/cmd/{name}.go`
3. **API module** — `harbinger-tools/frontend/src/api/{name}.ts`
4. **Zustand store** — `harbinger-tools/frontend/src/store/{name}Store.ts`
5. **Page** — `harbinger-tools/frontend/src/pages/{Name}/{Name}.tsx`
6. **Routes** — Register in `App.tsx` and `Sidebar.tsx`

## Adding a New Agent

1. Create directory: `agents/{name}/`
2. Add files: `CONFIG.yaml`, `IDENTITY.md`, `SOUL.md`, `SKILLS.md`, `HEARTBEAT.md`, `TOOLS.md`
3. Add template in `backend/cmd/agents.go` customTypes array
4. Add to `agentTypeToDir` map in `agents.go`
5. Add skill mapping in `backend/cmd/skills.go`
6. Add color to `typeToColor` in `agentStore.ts`
7. Add personality to `AGENT_PERSONALITIES` in `agentStore.ts`
8. Add icon to `TYPE_ICON` in `Dashboard.tsx`

## What We Accept

- Security tool integrations
- New agent profiles with real capabilities
- UI pages following Obsidian Command
- MCP server plugins
- Workflow templates
- Bug fixes with tests
- Documentation improvements

## What We Don't Accept

- Light themes or generic AI chat UIs
- npm or yarn lock files
- Hardcoded API keys or credentials
- Placeholder or demo code
- Dependencies without clear justification
- Changes to agent personalities without discussion

## Code of Conduct

Be professional. This is a security tool — treat it and its users with respect. Report security vulnerabilities via GitHub Issues with the `security` label.

## License

By contributing, you agree that your contributions will be licensed under MIT.
