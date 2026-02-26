# Debug Workflow

Step-by-step process for diagnosing and fixing Harbinger bugs.

## Triage

1. **Identify the layer**: Frontend (TypeScript/React), Backend (Go), or Infrastructure (Docker/DB)?
2. **Reproduce**: What exact action triggers the bug? What error appears?
3. **Isolate**: Is it a build error, runtime error, or logic error?

## Frontend Debugging

### Build errors (TypeScript)
```bash
cd harbinger-tools/frontend && npx tsc --noEmit 2>&1 | head -30
```
Read the error, find the file:line, fix the type.

### Runtime errors (browser)
1. Open browser DevTools console
2. Look for red errors — note the component stack trace
3. Read the source file at the reported location
4. Common causes: undefined access, missing props, stale state

### State bugs (Zustand)
1. Check the store file for the relevant action
2. Verify the state update uses callback form: `set((s) => ({...}))`
3. Check persist key isn't corrupted: `localStorage.getItem('harbinger-{name}')`
4. Nuclear option: `localStorage.removeItem('harbinger-{name}')` to reset

### API call failures
1. Check browser Network tab for the failing request
2. Verify the endpoint matches a backend route
3. Check Vite proxy config in `vite.config.ts`
4. Test directly: `curl http://localhost:8080/api/endpoint`

## Backend Debugging

### Build errors (Go)
```bash
cd backend && go build ./cmd/ 2>&1
```
Go errors are explicit — file:line:column with description.

### Runtime errors
```bash
cd backend && go run ./cmd/ 2>&1
```
Watch stdout for `[Module]` prefixed log messages.

### Database issues
1. Check PostgreSQL is running: `docker ps | grep postgres`
2. Test connection: `psql -h localhost -U harbinger -d harbinger`
3. Backend degrades gracefully without DB — check if in-memory mode

## Fix Verification

After fixing:
1. Run `npx tsc --noEmit` for TypeScript
2. Run `pnpm build:ui` for full frontend build
3. Run `go build -o /dev/null ./cmd/` for Go backend
4. Test the specific flow that was broken
