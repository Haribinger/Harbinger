# Common Harbinger Error Patterns

## Frontend (TypeScript/React)

### "Property X does not exist on type Y"
**Cause:** Type mismatch — usually API response shape changed or store type is wrong.
**Fix:** Check the type definition in `types/index.ts`. If the field exists in the API response but not the type, add it. If the field was removed, update all references.

### "Type 'any' is not assignable to..."
**Cause:** Strict mode catching an `any` that flows into a typed variable.
**Fix:** Add proper type annotation at the source. For catch blocks: `catch (err: unknown)` + `err instanceof Error`.

### "Cannot find module './xxx'"
**Cause:** Missing import, wrong path, or file was moved/deleted.
**Fix:** Check if the file exists. Path aliases: `@/*` maps to `src/*`, `@components/*` maps to `src/components/*`, etc. Check `tsconfig.json` paths.

### "Objects are not valid as a React child"
**Cause:** Trying to render an object directly in JSX.
**Fix:** Render a specific property (`obj.name`) or `JSON.stringify(obj)` for debug.

### Blank page / white screen
**Cause:** Usually an uncaught error in a component. Check browser console.
**Fix:** Wrap the component tree in ErrorBoundary. Check that lazy imports resolve correctly.

### "CORS error" in console
**Cause:** Vite proxy not configured for the requested path, or backend CORS allowlist missing.
**Fix:** Check `vite.config.ts` proxy entries. Backend allowlist is in `main.go` (~line 407-414).

### Store state not persisting
**Cause:** Persist key mismatch or localStorage quota exceeded.
**Fix:** Check the `name` in persist config matches `harbinger-{store-name}`. Clear localStorage if corrupted: `localStorage.clear()`.

## Backend (Go)

### "cannot use X as type Y"
**Cause:** Type mismatch in Go struct or function argument.
**Fix:** Check struct definitions. Go is strict — no implicit casting.

### "undefined: functionName"
**Cause:** Function defined in a different file but not in the `main` package.
**Fix:** All files in `backend/cmd/` must have `package main` at the top. Check the file exists and compiles.

### "sql: database is closed" or "connection refused"
**Cause:** PostgreSQL not running or credentials wrong.
**Fix:** Check `docker-compose.yml` for PostgreSQL service. Verify `.env` has correct DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME. Backend has in-memory fallback if DB is unavailable.

### "listen tcp :8080: bind: address already in use"
**Cause:** Another instance running on port 8080.
**Fix:** `lsof -i :8080` to find the PID, then `kill` it. Or change the port with `PORT=8081`.

### 404 on API routes
**Cause:** Route not registered in `main.go` mux setup.
**Fix:** Add `mux.HandleFunc("/api/path", handlerFunc)` in the route registration block.

## Build System

### "pnpm build" fails but "pnpm build:ui" works
**Cause:** `pnpm build` runs the root Next.js build (not the main UI). Use `pnpm build:ui` for the Vite SPA.

### "Module not found" during build
**Cause:** Missing dependency. Run `pnpm install` in the correct directory.
**Fix:** `cd harbinger-tools/frontend && pnpm install` for frontend deps.

### Go module errors
**Cause:** Missing go.sum entries or outdated modules.
**Fix:** `cd backend && go mod tidy && go mod download`
