# Harbinger Update Checklist

Use this checklist when performing maintenance updates.

## Pre-Update

- [ ] Check current branch is clean: `git status`
- [ ] Create a branch: `git checkout -b maintain/{date}`
- [ ] Note current dependency versions: `pnpm outdated`

## Dependency Updates

### Frontend (harbinger-tools/frontend/)

```bash
cd harbinger-tools/frontend

# Check what's outdated
pnpm outdated

# Update patch/minor (safe)
pnpm update

# Update specific major version (review changelog first)
pnpm add {package}@latest
```

**High-risk packages (review changelog before updating):**
- `react`, `react-dom` — major React version changes break hooks/components
- `vite` — major Vite versions change config format
- `@xyflow/react` — breaking API changes between majors
- `zustand` — v4 to v5 changed persist API

**Safe to update freely:**
- `lucide-react` — icon library, additive changes
- `framer-motion` — animation library, backward compatible
- `recharts` — chart library, minor changes

### Root (package.json)

```bash
cd /home/anon/Harbinger
pnpm outdated
pnpm update
```

### Backend (backend/)

```bash
cd backend
go get -u ./...
go mod tidy
go build ./cmd/
```

## Post-Update Verification

1. **TypeScript check:** `cd harbinger-tools/frontend && npx tsc --noEmit`
2. **Frontend build:** `pnpm build:ui`
3. **Backend build:** `cd backend && go build -o /dev/null ./cmd/`
4. **Visual check:** `pnpm dev` and browse all pages
5. **Store integrity:** Clear localStorage and verify pages load with fresh state

## Convention Enforcement Checks

### Design System
- All new colors must be from Obsidian Command palette
- No light backgrounds, no non-monospace fonts
- Gold (#f0c040) for primary actions only

### Code Patterns
- Stores use persist middleware with `harbinger-` prefix
- API responses normalized with Array.isArray pattern
- Error handling follows No-Crash Policy
- No `any` types in new code
- No console.log in new code (console.error in catch blocks OK temporarily)

### File Organization
- Pages in `pages/{Name}/{Name}.tsx`
- Stores in `store/{name}Store.ts`
- API modules in `api/{name}.ts`
- Types in `types/index.ts` or `types/{name}.ts`
- Backend handlers in `backend/cmd/{name}.go`

## Monthly Maintenance Tasks

1. Run `dep-check.sh` for outdated dependencies
2. Run `cleanup.sh` for stale files and orphan directories
3. Run healthcheck scan for accumulated code quality issues
4. Review and update CLAUDE.md if project structure changed
5. Update MEMORY.md with any new patterns or conventions
