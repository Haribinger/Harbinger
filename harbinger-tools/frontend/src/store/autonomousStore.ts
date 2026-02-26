import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { autonomousApi } from '../api/autonomous'
import type { AgentThought, SwarmState, AutonomousStats } from '../api/autonomous'

interface AutonomousState {
  thoughts: AgentThought[]
  swarm: SwarmState | null
  stats: AutonomousStats | null
  isLoading: boolean
  error: string | null

  // Filters
  selectedAgent: string
  selectedType: string
  selectedStatus: string

  // Actions
  setFilter: (key: 'selectedAgent' | 'selectedType' | 'selectedStatus', value: string) => void
  fetchThoughts: () => Promise<void>
  fetchSwarm: () => Promise<void>
  fetchStats: () => Promise<void>
  refresh: () => Promise<void>
  approveThought: (id: string) => Promise<void>
  rejectThought: (id: string) => Promise<void>
  implementThought: (id: string) => Promise<void>
  deleteThought: (id: string) => Promise<void>
}

export const useAutonomousStore = create<AutonomousState>()(
  persist(
    (set, get) => ({
      thoughts: [],
      swarm: null,
      stats: null,
      isLoading: false,
      error: null,
      selectedAgent: '',
      selectedType: '',
      selectedStatus: '',

      setFilter: (key, value) => {
        set({ [key]: value })
        get().fetchThoughts()
      },

      fetchThoughts: async () => {
        set({ isLoading: true, error: null })
        try {
          const { selectedAgent, selectedType, selectedStatus } = get()
          const data = await autonomousApi.listThoughts({
            agent_id: selectedAgent || undefined,
            type: selectedType || undefined,
            status: selectedStatus || undefined,
            limit: 200,
          })
          set({ thoughts: data.thoughts || [], isLoading: false })
        } catch (err: any) {
          set({ error: err.message || 'Failed to fetch thoughts', isLoading: false })
        }
      },

      fetchSwarm: async () => {
        try {
          const data = await autonomousApi.getSwarmState()
          set({ swarm: data.swarm || null })
        } catch {
          // Non-critical
        }
      },

      fetchStats: async () => {
        try {
          const data = await autonomousApi.getStats()
          set({ stats: data.stats || null })
        } catch {
          // Non-critical
        }
      },

      refresh: async () => {
        await Promise.all([get().fetchThoughts(), get().fetchSwarm(), get().fetchStats()])
      },

      approveThought: async (id) => {
        try {
          await autonomousApi.updateThought(id, 'approved')
          set((s) => ({
            thoughts: s.thoughts.map((t) => (t.id === id ? { ...t, status: 'approved' as const } : t)),
          }))
        } catch (err: any) {
          set({ error: err.message || 'Failed to approve thought' })
        }
      },

      rejectThought: async (id) => {
        try {
          await autonomousApi.updateThought(id, 'rejected')
          set((s) => ({
            thoughts: s.thoughts.map((t) => (t.id === id ? { ...t, status: 'rejected' as const } : t)),
          }))
        } catch (err: any) {
          set({ error: err.message || 'Failed to reject thought' })
        }
      },

      implementThought: async (id) => {
        try {
          await autonomousApi.updateThought(id, 'implemented')
          set((s) => ({
            thoughts: s.thoughts.map((t) => (t.id === id ? { ...t, status: 'implemented' as const } : t)),
          }))
        } catch (err: any) {
          set({ error: err.message || 'Failed to mark thought as implemented' })
        }
      },

      deleteThought: async (id) => {
        try {
          await autonomousApi.deleteThought(id)
          set((s) => ({
            thoughts: s.thoughts.filter((t) => t.id !== id),
          }))
        } catch (err: any) {
          set({ error: err.message || 'Failed to delete thought' })
        }
      },
    }),
    {
      name: 'harbinger-autonomous',
      partialize: (state) => ({
        selectedAgent: state.selectedAgent,
        selectedType: state.selectedType,
        selectedStatus: state.selectedStatus,
      }),
    }
  )
)
