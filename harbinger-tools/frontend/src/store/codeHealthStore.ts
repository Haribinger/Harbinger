import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { codeHealthApi } from '../api/codeHealth'
import type { HealthMetric, CurrentHealth } from '../api/codeHealth'

interface CodeHealthState {
  metrics: HealthMetric[]
  current: CurrentHealth | null
  range: 'week' | 'month' | 'quarter'
  isLoading: boolean
  error: string | null

  setRange: (range: 'week' | 'month' | 'quarter') => void
  fetchHistory: () => Promise<void>
  fetchCurrent: () => Promise<void>
  refresh: () => Promise<void>
}

export const useCodeHealthStore = create<CodeHealthState>()(
  persist(
    (set, get) => ({
      metrics: [],
      current: null,
      range: 'month',
      isLoading: false,
      error: null,

      setRange: (range) => {
        set({ range })
        get().fetchHistory()
      },

      fetchHistory: async () => {
        set({ isLoading: true, error: null })
        try {
          const data = await codeHealthApi.getHistory(get().range)
          set({ metrics: data.metrics || [], isLoading: false })
        } catch (err: any) {
          set({ error: err.message || 'Failed to fetch health history', isLoading: false })
        }
      },

      fetchCurrent: async () => {
        try {
          const data = await codeHealthApi.getCurrent()
          set({ current: data.current || null })
        } catch {
          // Non-critical — dashboard still works without current
        }
      },

      refresh: async () => {
        await Promise.all([get().fetchHistory(), get().fetchCurrent()])
      },
    }),
    {
      name: 'harbinger-code-health',
      partialize: (state) => ({ range: state.range }),
    }
  )
)
