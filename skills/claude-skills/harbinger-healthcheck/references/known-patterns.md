# Known Harbinger Code Patterns

Patterns that are intentional and should NOT be flagged as issues.

## Intentional Patterns

### In-Memory Fallback
Backend runs without PostgreSQL — `if db == nil` checks are intentional, not bugs.

### API_BASE is empty string
`API_BASE = ''` — the Vite proxy handles routing. Never hardcode `:8080`.

### isTokenExpired returns boolean
This function returns `boolean`, NOT `APIResponse`. Do not wrap it.

### Dual token check
Code checks both `harbinger-token` and `harbinger-auth` localStorage keys.
This is legacy but intentional — both must be checked.

### ErrorBoundary console.error
`components/ErrorBoundary.tsx` has `console.error` in `componentDidCatch`.
This is intentional React error boundary behavior.

### Optional catch blocks
These patterns are intentional graceful degradation:
- `catch { /* stats are optional */ }` in BrowserManager
- `.catch(() => {})` for optional health checks in Dashboard
- `catch { // Backend not reachable }` in OpenClaw

### SEED_ROSTER fallback
Dashboard uses hardcoded SEED_ROSTER when API is unreachable.
This is the offline-first design — not a bug.

### Provider model fallback chain
```ts
const models = providers[id]?.models || PROVIDER_MODELS[id] || []
```
This triple fallback is intentional. The duplication between Settings.tsx
and SecretsManager.tsx IS a maintenance issue but NOT a runtime bug.
