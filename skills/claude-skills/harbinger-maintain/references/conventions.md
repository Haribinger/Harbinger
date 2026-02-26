# Harbinger Code Conventions

Definitive reference for project conventions. Enforce these during maintenance.

## TypeScript Conventions

### Imports
```typescript
// Order: React → third-party → local (stores, api, types, components)
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'
import { useAgentStore } from '../../store/agentStore'
import { agentsApi } from '../../api/agents'
import type { Agent } from '../../types'
```

### Error Handling
```typescript
// Catch blocks — always narrow the error
try {
  const data = await api.fetchItems()
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown error'
  setError(message)
}
```

### State Updates
```typescript
// Always use callback form when depending on previous state
set((state) => ({ items: [...state.items, newItem] }))

// Direct set only for independent values
set({ isLoading: true })
```

### API Responses
```typescript
// Always normalize array responses
const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : [])
```

## Go Conventions

### Handler Structure
```go
func handleX(w http.ResponseWriter, r *http.Request) {
    // 1. Method check
    // 2. Auth check (if needed)
    // 3. Parse request
    // 4. Validate
    // 5. DB operation (with dbAvailable() check)
    // 6. Response
}
```

### Error Responses
```go
// No-Crash Policy: structured error, never raw 500
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(map[string]interface{}{
    "ok":     false,
    "reason": "descriptive error message",
})
```

### Logging
```go
// Always prefix with module name
log.Printf("[Agents] spawn error: %v", err)
log.Printf("[DB] query failed: %v", err)
```

## CSS/Styling Conventions

### Color Palette (Obsidian Command)
```
#0a0a0f  — Background (page)
#0d0d15  — Surface (cards, panels)
#0f0f1a  — Panel (nested elements)
#1a1a2e  — Borders
#f0c040  — Gold accent (primary actions, highlights)
#ef4444  — Danger (errors, destructive actions)
#22c55e  — Success (confirmations, healthy status)
#9ca3af  — Muted text (secondary labels)
#4b5563  — Dim text (tertiary, timestamps)
#ffffff  — Primary text
```

### Typography
```
Font: JetBrains Mono, Fira Code, monospace
Sizes: 1.5rem (h1), 1.25rem (h2), 1rem (body), 0.875rem (small), 0.75rem (tiny)
```

### Layout
- Three-column grids preferred for information density
- Sidebar is fixed left, header is fixed top
- Content area scrolls independently
- Panels use `border: 1px solid #1a1a2e`, `borderRadius: 8` or `12`

## Git Conventions

- Branch naming: `feat/{feature}`, `fix/{bug}`, `maintain/{date}`
- Commit messages: imperative mood, lowercase, no period
- Never commit: `.env`, `node_modules/`, `dist/`, `*.log`
- Build command: `pnpm build:ui` (NOT `pnpm build`)
- Package manager: `pnpm` only (never npm or yarn)
