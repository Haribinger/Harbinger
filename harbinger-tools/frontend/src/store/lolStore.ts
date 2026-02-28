import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { lolApi } from '../api/lol'
import type { LOLProject, LOLEntry, LOLChain, LOLStats } from '../api/lol'

interface LOLState {
  stats: LOLStats | null
  projects: LOLProject[]
  entries: LOLEntry[]
  searchResults: LOLEntry[]
  chains: LOLChain[]
  mitreMap: Record<string, LOLEntry[]>
  isLoading: boolean
  error: string | null

  // Filters
  selectedProject: string
  selectedPlatform: string
  selectedCategory: string
  searchQuery: string

  // Actions
  setFilter: (key: 'selectedProject' | 'selectedPlatform' | 'selectedCategory' | 'searchQuery', value: string) => void
  fetchStats: () => Promise<void>
  fetchProjects: () => Promise<void>
  fetchEntries: (filters?: { projectId?: string; platform?: string; category?: string; tag?: string; mitreId?: string }) => Promise<void>
  searchEntries: (query: string) => Promise<void>
  fetchMitreMap: () => Promise<void>
  fetchChains: () => Promise<void>
  createChain: (data: Partial<LOLChain>) => Promise<void>
  deleteChain: (id: string) => Promise<void>
  addEntry: (data: Partial<LOLEntry>) => Promise<void>
  refresh: () => Promise<void>
}

export const useLOLStore = create<LOLState>()(
  persist(
    (set, get) => ({
      stats: null,
      projects: [],
      entries: [],
      searchResults: [],
      chains: [],
      mitreMap: {},
      isLoading: false,
      error: null,
      selectedProject: '',
      selectedPlatform: '',
      selectedCategory: '',
      searchQuery: '',

      setFilter: (key, value) => {
        set({ [key]: value })
        const state = get()
        state.fetchEntries({
          projectId: key === 'selectedProject' ? value : state.selectedProject || undefined,
          platform: key === 'selectedPlatform' ? value : state.selectedPlatform || undefined,
          category: key === 'selectedCategory' ? value : state.selectedCategory || undefined,
        })
      },

      fetchStats: async () => {
        try {
          const data = await lolApi.getStats()
          set({ stats: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch LOL stats' })
        }
      },

      fetchProjects: async () => {
        set({ isLoading: true, error: null })
        try {
          const data = await lolApi.listProjects()
          set({ projects: data, isLoading: false })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch projects', isLoading: false })
        }
      },

      fetchEntries: async (filters) => {
        set({ isLoading: true, error: null })
        try {
          const data = await lolApi.listEntries(filters)
          set({ entries: data, isLoading: false })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch entries', isLoading: false })
        }
      },

      searchEntries: async (query) => {
        if (!query.trim()) {
          set({ searchResults: [] })
          return
        }
        set({ isLoading: true, searchQuery: query })
        try {
          const data = await lolApi.search(query)
          set({ searchResults: data.results || [], isLoading: false })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Search failed', isLoading: false })
        }
      },

      fetchMitreMap: async () => {
        try {
          const data = await lolApi.getByMitre()
          set({ mitreMap: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch MITRE map' })
        }
      },

      fetchChains: async () => {
        try {
          const data = await lolApi.listChains()
          set({ chains: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch chains' })
        }
      },

      createChain: async (data) => {
        try {
          await lolApi.createChain(data)
          get().fetchChains()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to create chain' })
        }
      },

      deleteChain: async (id) => {
        try {
          await lolApi.deleteChain(id)
          get().fetchChains()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to delete chain' })
        }
      },

      addEntry: async (data) => {
        try {
          await lolApi.addEntry(data)
          get().fetchEntries()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to add entry' })
        }
      },

      refresh: async () => {
        const state = get()
        await Promise.all([
          state.fetchStats(),
          state.fetchProjects(),
          state.fetchEntries(),
          state.fetchChains(),
        ])
      },
    }),
    {
      name: 'harbinger-lol',
      partialize: (state) => ({
        selectedProject: state.selectedProject,
        selectedPlatform: state.selectedPlatform,
        selectedCategory: state.selectedCategory,
      }),
    }
  )
)
