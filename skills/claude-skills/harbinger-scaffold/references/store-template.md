# Zustand Store Template

Harbinger uses Zustand 5 with persist middleware. 16 stores currently exist.

## Template

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Types
interface Item {
  id: string
  name: string
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

interface StoreState {
  // State
  items: Item[]
  selectedId: string | null
  isLoading: boolean
  error: string | null

  // Actions
  setItems: (items: Item[]) => void
  addItem: (item: Item) => void
  updateItem: (id: string, updates: Partial<Item>) => void
  removeItem: (id: string) => void
  setSelected: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  fetchItems: () => Promise<void>
}

export const useItemStore = create<StoreState>()(
  persist(
    (set, _get) => ({
      // Initial state
      items: [],
      selectedId: null,
      isLoading: false,
      error: null,

      // Setters
      setItems: (items) => set({ items }),
      addItem: (item) => set((s) => ({ items: [...s.items, item] })),
      updateItem: (id, updates) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        })),
      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      setSelected: (selectedId) => set({ selectedId }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      // Async
      fetchItems: async () => {
        set({ isLoading: true, error: null })
        try {
          const res = await fetch('/api/items')
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : [])
          set({ items, isLoading: false })
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Failed to fetch',
            isLoading: false,
          })
        }
      },
    }),
    { name: 'harbinger-item-store' }
  )
)
```

## Key Conventions

- Persist key format: `harbinger-{store-name}`
- Use `(s) => ({...})` callback for state updates that depend on current state
- API response normalization: `Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : [])`
- Error handling: `catch (err: unknown)` with `err instanceof Error` narrowing
- Never import other stores inside a store — keep them independent
