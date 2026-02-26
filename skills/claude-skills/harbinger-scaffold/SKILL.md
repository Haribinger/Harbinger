---
name: harbinger-scaffold
description: >
  Generate new Harbinger components following exact project patterns.
  Scaffolds new pages, Zustand stores, API modules, Go backend handlers,
  agent profiles, and skill directories — all matching Harbinger's Obsidian
  Command design system and architecture conventions.
  Use when: "add a new page", "create a store", "new API endpoint",
  "add an agent", "scaffold a component", "new feature", "add a skill",
  "create a handler", "new module", or any request to add new code to Harbinger.
---

# Harbinger Scaffold

Generate new code components following exact Harbinger patterns.

## Available Templates

| Type | Template | Output Location |
|------|----------|-----------------|
| Page | [page-template.md](references/page-template.md) | `harbinger-tools/frontend/src/pages/{Name}/` |
| Store | [store-template.md](references/store-template.md) | `harbinger-tools/frontend/src/store/{name}Store.ts` |
| API Module | [api-template.md](references/api-template.md) | `harbinger-tools/frontend/src/api/{name}.ts` |
| Backend Handler | [backend-handler-template.md](references/backend-handler-template.md) | `backend/cmd/{name}.go` |
| Agent Profile | [agent-template.md](references/agent-template.md) | `agents/{name}/` |

## Workflow

1. Determine what the user needs (page, store, API, handler, agent, or combination)
2. Read the relevant template(s) from references/
3. Customize the template with user's requirements
4. Generate the code following all conventions
5. Register the new component (routes, sidebar, imports)

## Full Feature Scaffold

When adding a complete feature (e.g., "add a vulnerability tracker"), scaffold in this order:

1. **Types** — Add interfaces to `harbinger-tools/frontend/src/types/index.ts`
2. **Backend handler** — New Go file in `backend/cmd/`
3. **API module** — New file in `harbinger-tools/frontend/src/api/`
4. **Store** — New Zustand store in `harbinger-tools/frontend/src/store/`
5. **Page** — New page directory in `harbinger-tools/frontend/src/pages/`
6. **Route** — Register in App.tsx and Sidebar.tsx

## Design System Requirements

Every UI component MUST use:
- Background: `#0a0a0f`
- Surface panels: `#0d0d15`
- Borders: `#1a1a2e`
- Accent color: `#f0c040` (gold)
- Font: monospace (`JetBrains Mono, Fira Code, monospace`)
- No light themes, no chat bubbles, no typing indicators
- Three-column layouts preferred, information-dense
- Motion: `framer-motion` for page transitions

## Naming Conventions

- Pages: PascalCase directory and file (`RedTeam/RedTeam.tsx`)
- Stores: camelCase with `Store` suffix (`bugBountyStore.ts`)
- API modules: camelCase (`bugbounty.ts`)
- Backend: lowercase with descriptive name (`browsers.go`)
- Agents: kebab-case directory (`browser-agent/`)
- Types: PascalCase interfaces (`BugBountyProgram`)
