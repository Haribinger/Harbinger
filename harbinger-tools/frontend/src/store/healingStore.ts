import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { healingApi } from '../api/healing'
import type { HealingEvent, HealingStats, HealingConfig, HealingStatus } from '../api/healing'

interface HealingState {
  events: HealingEvent[]
  stats: HealingStats | null
  status: HealingStatus | null
  config: HealingConfig | null
  isLoading: boolean
  error: string | null

  // Filters
  selectedType: string
  selectedSeverity: string

  // Actions
  setFilter: (key: 'selectedType' | 'selectedSeverity', value: string) => void
  fetchEvents: (filters?: { type?: string; severity?: string; limit?: number }) => Promise<void>
  fetchStats: () => Promise<void>
  fetchStatus: () => Promise<void>
  fetchConfig: () => Promise<void>
  startMonitor: () => Promise<void>
  stopMonitor: () => Promise<void>
  updateConfig: (config: Partial<HealingConfig>) => Promise<void>
  addLocalEvent: (event: HealingEvent) => void
  refresh: () => Promise<void>
}

export const useHealingStore = create<HealingState>()(
  persist(
    (set, get) => ({
      events: [],
      stats: null,
      status: null,
      config: null,
      isLoading: false,
      error: null,
      selectedType: '',
      selectedSeverity: '',

      setFilter: (key, value) => set({ [key]: value }),

      fetchEvents: async (filters) => {
        set({ isLoading: true, error: null })
        try {
          const result = await healingApi.listEvents(filters)
          set({ events: result.events || [], isLoading: false })
        } catch (err) {
          set({ error: String(err), isLoading: false })
        }
      },

      fetchStats: async () => {
        try {
          const result = await healingApi.getStats()
          set({ stats: result.stats })
        } catch (err) {
          set({ error: String(err) })
        }
      },

      fetchStatus: async () => {
        try {
          const result = await healingApi.getStatus()
          set({
            status: {
              running: result.running,
              last_poll_at: result.last_poll_at,
              config: result.config,
            },
          })
        } catch (err) {
          set({ error: String(err) })
        }
      },

      fetchConfig: async () => {
        try {
          const result = await healingApi.getConfig()
          set({ config: result.config })
        } catch (err) {
          set({ error: String(err) })
        }
      },

      startMonitor: async () => {
        try {
          await healingApi.startMonitor()
          await get().fetchStatus()
        } catch (err) {
          set({ error: String(err) })
        }
      },

      stopMonitor: async () => {
        try {
          await healingApi.stopMonitor()
          await get().fetchStatus()
        } catch (err) {
          set({ error: String(err) })
        }
      },

      updateConfig: async (config) => {
        try {
          const result = await healingApi.updateConfig(config)
          set({ config: result.config })
        } catch (err) {
          set({ error: String(err) })
        }
      },

      addLocalEvent: (event) => {
        set((state) => ({
          events: [event, ...state.events].slice(0, 500),
        }))
      },

      refresh: async () => {
        const state = get()
        await Promise.all([
          state.fetchEvents({ type: state.selectedType || undefined, severity: state.selectedSeverity || undefined }),
          state.fetchStats(),
          state.fetchStatus(),
        ])
      },
    }),
    {
      name: 'harbinger-healing',
      partialize: (state) => ({
        selectedType: state.selectedType,
        selectedSeverity: state.selectedSeverity,
      }),
    }
  )
)
