# Page Template

Every Harbinger page follows this exact structure.

## Directory Structure

```
harbinger-tools/frontend/src/pages/{PageName}/
├── {PageName}.tsx        # Main page component
└── index.ts              # Re-export (optional)
```

## Template

```tsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { LucideIconName } from 'lucide-react'
// Import relevant store
// import { useXxxStore } from '../../store/xxxStore'

// Constants — Obsidian Command palette
const C = {
  bg: '#0a0a0f',
  surface: '#0d0d15',
  panel: '#0f0f1a',
  border: '#1a1a2e',
  gold: '#f0c040',
  danger: '#ef4444',
  success: '#22c55e',
  muted: '#9ca3af',
  dim: '#4b5563',
  white: '#ffffff',
}

export default function PageName() {
  // Store hooks
  // const { items, fetchItems } = useXxxStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch data on mount
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ padding: '1.5rem', minHeight: '100vh', background: C.bg }}
    >
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.white, fontFamily: 'monospace' }}>
            PAGE TITLE
          </h1>
          <p style={{ color: C.muted, fontSize: '0.875rem', fontFamily: 'monospace' }}>
            Subtitle description
          </p>
        </div>
        {/* Action buttons go here */}
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#ef444420', border: `1px solid ${C.danger}`, borderRadius: 8, color: C.danger, marginBottom: '1rem', fontFamily: 'monospace' }}>
          {error}
        </div>
      )}

      {/* Main content — three-column layout preferred */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
        {/* Panels */}
      </div>
    </motion.div>
  )
}
```

## Registration

Add to `harbinger-tools/frontend/src/App.tsx` lazy routes:

```tsx
const PageName = lazy(() => import('./pages/PageName/PageName'))

// In routes array:
{ path: '/page-name', element: <PageName /> }
```

Add to `harbinger-tools/frontend/src/components/Layout/Sidebar.tsx`:

```tsx
{ path: '/page-name', label: 'Page Name', icon: LucideIconName }
```
