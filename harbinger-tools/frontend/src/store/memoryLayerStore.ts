import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { memoryLayerApi } from '../api/memoryLayer'
import type { MemorySearchResult, MemoryDashboard, UnifiedSearchRequest } from '../api/memoryLayer'

interface MemoryLayerState {
  dashboard: MemoryDashboard | null
  searchResults: MemorySearchResult[]
  workingMemory: Record<string, string>
  isLoading: boolean
  error: string | null

  // Filters
  searchQuery: string
  selectedLayers: string[]
  selectedMissionId: string
  selectedAgentId: string

  // Actions
  setFilter: (key: 'searchQuery' | 'selectedMissionId' | 'selectedAgentId', value: string) => void
  setSelectedLayers: (layers: string[]) => void
  fetchDashboard: () => Promise<void>
  searchAll: (request?: Partial<UnifiedSearchRequest>) => Promise<void>
  setWorking: (missionId: string, key: string, value: string) => Promise<void>
  getWorking: (missionId: string, key: string) => Promise<string>
  getAllWorking: (missionId: string) => Promise<void>
  clearWorking: (missionId: string) => Promise<void>
  summarize: (text: string, toolName?: string) => Promise<string>
  refresh: () => Promise<void>
}

export const useMemoryLayerStore = create<MemoryLayerState>()(
  persist(
    (set, get) => ({
      dashboard: null,
      searchResults: [],
      workingMemory: {},
      isLoading: false,
      error: null,
      searchQuery: '',
      selectedLayers: [],
      selectedMissionId: '',
      selectedAgentId: '',

      setFilter: (key, value) => set({ [key]: value }),

      setSelectedLayers: (layers) => set({ selectedLayers: layers }),

      fetchDashboard: async () => {
        set({ isLoading: true, error: null })
        try {
          const data = await memoryLayerApi.getDashboard()
          set({ dashboard: data, isLoading: false })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch memory dashboard', isLoading: false })
        }
      },

      searchAll: async (request) => {
        const state = get()
        const merged: UnifiedSearchRequest = {
          query: request?.query ?? state.searchQuery,
          mission_id: request?.mission_id ?? (state.selectedMissionId || undefined),
          agent_id: request?.agent_id ?? (state.selectedAgentId || undefined),
          layers: request?.layers ?? (state.selectedLayers.length ? state.selectedLayers : undefined),
          limit: request?.limit,
        }
        set({ isLoading: true, error: null })
        try {
          const data = await memoryLayerApi.searchAll(merged)
          set({ searchResults: data, isLoading: false })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to search memory layers', isLoading: false })
        }
      },

      setWorking: async (missionId, key, value) => {
        try {
          await memoryLayerApi.setWorking(missionId, key, value)
          // Refresh working memory for this mission if it's the currently selected one
          if (get().selectedMissionId === missionId) {
            await get().getAllWorking(missionId)
          }
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to set working memory' })
        }
      },

      getWorking: async (missionId, key) => {
        try {
          const result = await memoryLayerApi.getWorking(missionId, key)
          return result.value
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to get working memory' })
          return ''
        }
      },

      getAllWorking: async (missionId) => {
        try {
          const data = await memoryLayerApi.getAllWorking(missionId)
          set({ workingMemory: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch working memory' })
        }
      },

      clearWorking: async (missionId) => {
        try {
          await memoryLayerApi.clearWorking(missionId)
          set({ workingMemory: {} })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to clear working memory' })
        }
      },

      summarize: async (text, toolName) => {
        try {
          const result = await memoryLayerApi.summarize(text, toolName)
          return result.summary
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to summarize text' })
          return ''
        }
      },

      refresh: async () => {
        const state = get()
        const tasks: Promise<void>[] = [state.fetchDashboard()]
        if (state.searchQuery) {
          tasks.push(state.searchAll())
        }
        if (state.selectedMissionId) {
          tasks.push(state.getAllWorking(state.selectedMissionId))
        }
        await Promise.all(tasks)
      },
    }),
    {
      name: 'harbinger-memory-layer',
      partialize: (state) => ({
        searchQuery: state.searchQuery,
        selectedLayers: state.selectedLayers,
        selectedMissionId: state.selectedMissionId,
        selectedAgentId: state.selectedAgentId,
      }),
    }
  )
)
