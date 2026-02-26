# Fix Prompt Templates

Copy-paste prompts for the user to give Claude Code to fix each issue category.

## any Type Fixes

```
Fix the `any` types in {FILE_PATH}. Replace each `any` with the correct TypeScript type.
For catch blocks, use `catch (err: unknown)` and narrow with `err instanceof Error`.
For data parsing functions, define proper interfaces based on the API response shape.
Do not use `as` type assertions unless the type is genuinely ambiguous.
```

## Console Statement Cleanup

```
Remove or replace console statements in {FILE_PATH}.
- console.error in catch blocks → keep but wrap in a debug flag or remove if the error is already handled by UI state
- console.log for debugging → remove entirely
- console.warn for deprecations → keep only if it's a real deprecation notice
Do not remove console statements inside ErrorBoundary.tsx — those are intentional.
```

## API Response Normalization

```
The API response normalization pattern `Array.isArray(result) ? result : (Array.isArray(result?.items) ? result.items : [])` is repeated across multiple API files. Extract it into a shared utility in harbinger-tools/frontend/src/api/client.ts:

export function normalizeArrayResponse<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object' && 'items' in result && Array.isArray((result as any).items)) {
    return (result as Record<string, unknown>).items as T[];
  }
  return [];
}

Then update all API modules to use it.
```

## Provider Model Sync

```
PROVIDER_MODELS is defined in both Settings.tsx and SecretsManager.tsx. These must stay in sync.
Extract PROVIDER_MODELS into a shared constant in harbinger-tools/frontend/src/types/index.ts or a new file harbinger-tools/frontend/src/config/providers.ts, then import from both locations.
```

## Hardcoded Value Extraction

```
Move hardcoded localhost URLs in {FILE_PATH} to environment variables or the config system.
Use import.meta.env.VITE_* for frontend values.
Use getEnv("KEY", "default") pattern for backend Go values (already used in main.go).
```

## Empty Catch Block Fixes

```
Review catch blocks in {FILE_PATH} that swallow errors silently.
For optional features (health checks, stats), add an inline comment: `catch { /* {feature} is optional */ }`
For user-facing operations, set error state: `catch (err) { setError(err instanceof Error ? err.message : 'Unknown error') }`
```

## Design System Violations

```
Fix off-brand colors in {FILE_PATH}. Replace with Obsidian Command palette:
- Background: #0a0a0f
- Surface: #0d0d15
- Panel: #0f0f1a
- Border: #1a1a2e
- Accent/Gold: #f0c040
- Danger: #ef4444
- Success: #22c55e
- Muted text: #9ca3af
- Dim text: #4b5563
- Primary text: #ffffff
Font must be monospace (JetBrains Mono, Fira Code).
```

## TypeScript Strictness

```
Enable stricter TypeScript checks in harbinger-tools/frontend/tsconfig.json:
1. Set "noUnusedLocals": true
2. Set "noUnusedParameters": true
3. Run `pnpm build:ui` to find all new errors
4. Fix each error — remove unused imports, prefix unused params with underscore
```

## Backend Error Handling

```
Review error handling in {FILE_PATH} (Go backend).
Ensure every function that returns an error has its error checked.
Pattern: if err != nil { http.Error(w, ..., status); return }
Never log and return — do one or the other.
Follow the No-Crash Policy: return {ok:false, reason:"..."} JSON, never raw 500.
```

## Missing Test Coverage

```
Add tests for {MODULE}:
- Frontend: Create harbinger-tools/frontend/src/{path}/__tests__/{name}.test.ts
  Use Vitest (add to devDependencies if not present)
  Test the store actions, API response handling, and component rendering
- Backend: Create backend/cmd/{name}_test.go
  Use Go standard testing package
  Test handler responses, database operations, and edge cases
```
