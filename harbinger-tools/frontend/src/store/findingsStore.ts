import { create } from 'zustand'
import { findingsApi } from '../api/findings'
import type { Finding, FindingsSummary, FindingsFilters, FindingSSEEvent } from '../api/findings'

interface FindingsState {
  findings: Finding[]
  summary: FindingsSummary | null
  selectedFinding: Finding | null
  filters: FindingsFilters
  isLoading: boolean
  error: string | null
  sseConnected: boolean
  sseSource: EventSource | null

  // Actions
  fetchFindings: (filters?: FindingsFilters) => Promise<void>
  fetchSummary: (missionId?: string) => Promise<void>
  createFinding: (finding: Partial<Finding>) => Promise<Finding | null>
  updateFinding: (id: string, data: Partial<Finding>) => Promise<void>
  deleteFinding: (id: string) => Promise<void>
  selectFinding: (finding: Finding | null) => void
  toggleFalsePositive: (id: string, falsePositive: boolean, reason?: string) => Promise<void>
  setFilters: (filters: Partial<FindingsFilters>) => void
  clearFilters: () => void
  exportFindings: (format: 'json' | 'csv') => Promise<void>
  connectSSE: (missionId?: string) => void
  disconnectSSE: () => void
  handleSSEEvent: (event: FindingSSEEvent) => void
  refresh: () => Promise<void>
}

export const useFindingsStore = create<FindingsState>()((set, get) => ({
  findings: [],
  summary: null,
  selectedFinding: null,
  filters: {},
  isLoading: false,
  error: null,
  sseConnected: false,
  sseSource: null,

  fetchFindings: async (filters?: FindingsFilters) => {
    set({ isLoading: true, error: null })
    try {
      const activeFilters = filters ?? get().filters
      const data = await findingsApi.list(activeFilters)
      set({ findings: data, isLoading: false })
    } catch {
      set({ error: 'Failed to load findings', isLoading: false })
    }
  },

  fetchSummary: async (missionId?: string) => {
    try {
      const summary = await findingsApi.summary(missionId ?? get().filters.missionId)
      set({ summary })
    } catch {
      // Non-critical — page still works without summary
    }
  },

  createFinding: async (finding) => {
    try {
      const created = await findingsApi.create(finding)
      set((state) => ({ findings: [created, ...state.findings] }))
      return created
    } catch {
      set({ error: 'Failed to create finding' })
      return null
    }
  },

  updateFinding: async (id, data) => {
    try {
      const updated = await findingsApi.update(id, data)
      set((state) => ({
        findings: state.findings.map((f) => (f.id === id ? updated : f)),
        selectedFinding: state.selectedFinding?.id === id ? updated : state.selectedFinding,
      }))
    } catch {
      set({ error: 'Failed to update finding' })
    }
  },

  deleteFinding: async (id) => {
    try {
      await findingsApi.delete(id)
      set((state) => ({
        findings: state.findings.filter((f) => f.id !== id),
        selectedFinding: state.selectedFinding?.id === id ? null : state.selectedFinding,
      }))
    } catch {
      set({ error: 'Failed to delete finding' })
    }
  },

  selectFinding: (finding) => set({ selectedFinding: finding }),

  toggleFalsePositive: async (id, falsePositive, reason) => {
    try {
      const updated = await findingsApi.toggleFalsePositive(id, falsePositive, reason)
      set((state) => ({
        findings: state.findings.map((f) => (f.id === id ? updated : f)),
        selectedFinding: state.selectedFinding?.id === id ? updated : state.selectedFinding,
      }))
    } catch {
      set({ error: 'Failed to toggle false positive' })
    }
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }))
    get().fetchFindings()
  },

  clearFilters: () => {
    set({ filters: {} })
    get().fetchFindings()
  },

  exportFindings: async (format) => {
    try {
      const { filters } = get()
      const result = await findingsApi.exportFindings(
        filters.missionId,
        format,
        filters.hideFalsePositives
      )
      if (format === 'csv' && result instanceof Blob) {
        const url = URL.createObjectURL(result)
        const a = document.createElement('a')
        a.href = url
        a.download = `findings-${Date.now()}.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        // JSON export — download as file
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `findings-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      set({ error: 'Failed to export findings' })
    }
  },

  connectSSE: (missionId) => {
    const existing = get().sseSource
    if (existing) existing.close()

    const source = findingsApi.createStream(missionId)
    source.onopen = () => set({ sseConnected: true })
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as FindingSSEEvent
        get().handleSSEEvent(data)
      } catch {
        // Malformed SSE data — ignore
      }
    }
    source.onerror = () => {
      set({ sseConnected: false })
      // EventSource auto-reconnects
    }
    set({ sseSource: source, sseConnected: true })
  },

  disconnectSSE: () => {
    const source = get().sseSource
    if (source) source.close()
    set({ sseSource: null, sseConnected: false })
  },

  handleSSEEvent: (event) => {
    const { payload } = event
    if (payload.action === 'false_positive_toggle') {
      // Refresh the affected finding
      get().fetchFindings()
      return
    }
    // New finding arrived — refresh the list to get the full object
    get().fetchFindings()
    get().fetchSummary()
  },

  refresh: async () => {
    await Promise.all([get().fetchFindings(), get().fetchSummary()])
  },
}))
