import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { knowledgeGraphApi } from '../api/knowledgeGraph'
import type { GraphNode, GraphRelation, GraphNeighbors, GraphStats, GraphSearchResult, BulkIngestRequest } from '../api/knowledgeGraph'

interface KnowledgeGraphState {
  stats: GraphStats | null
  searchResults: GraphSearchResult[]
  selectedNode: GraphNode | null
  neighbors: GraphNeighbors | null
  attackPath: GraphNode[]
  isLoading: boolean
  error: string | null

  // Filters
  searchQuery: string
  selectedLabel: string

  // Actions
  setFilter: (key: 'searchQuery' | 'selectedLabel', value: string) => void
  fetchStats: () => Promise<void>
  searchGraph: (query: string, label?: string, limit?: number) => Promise<void>
  getNeighbors: (label: string, key: string, value: string, depth?: number) => Promise<void>
  getAttackPath: (missionId: string) => Promise<void>
  createNode: (node: { label: string; unique_key: string; properties: Record<string, unknown> }) => Promise<void>
  createRelation: (relation: GraphRelation) => Promise<void>
  bulkIngest: (data: BulkIngestRequest) => Promise<void>
  selectNode: (node: GraphNode | null) => void
  refresh: () => Promise<void>
}

export const useKnowledgeGraphStore = create<KnowledgeGraphState>()(
  persist(
    (set, get) => ({
      stats: null,
      searchResults: [],
      selectedNode: null,
      neighbors: null,
      attackPath: [],
      isLoading: false,
      error: null,
      searchQuery: '',
      selectedLabel: '',

      setFilter: (key, value) => set({ [key]: value }),

      fetchStats: async () => {
        set({ isLoading: true, error: null })
        try {
          const data = await knowledgeGraphApi.getStats()
          set({ stats: data, isLoading: false })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch graph stats', isLoading: false })
        }
      },

      searchGraph: async (query, label, limit) => {
        set({ isLoading: true, error: null })
        try {
          const data = await knowledgeGraphApi.search(query, label, limit)
          set({ searchResults: data, isLoading: false })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to search graph', isLoading: false })
        }
      },

      getNeighbors: async (label, key, value, depth) => {
        set({ isLoading: true, error: null })
        try {
          const data = await knowledgeGraphApi.getNeighbors(label, key, value, depth)
          set({ neighbors: data, isLoading: false })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch neighbors', isLoading: false })
        }
      },

      getAttackPath: async (missionId) => {
        set({ isLoading: true, error: null })
        try {
          const data = await knowledgeGraphApi.getAttackPath(missionId)
          set({ attackPath: data, isLoading: false })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch attack path', isLoading: false })
        }
      },

      createNode: async (node) => {
        try {
          await knowledgeGraphApi.createNode(node)
          get().fetchStats()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to create node' })
        }
      },

      createRelation: async (relation) => {
        try {
          await knowledgeGraphApi.createRelation(relation)
          get().fetchStats()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to create relation' })
        }
      },

      bulkIngest: async (data) => {
        set({ isLoading: true, error: null })
        try {
          await knowledgeGraphApi.bulkIngest(data)
          await get().fetchStats()
          set({ isLoading: false })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to bulk ingest', isLoading: false })
        }
      },

      selectNode: (node) => set({ selectedNode: node }),

      refresh: async () => {
        const state = get()
        const tasks: Promise<void>[] = [state.fetchStats()]
        if (state.searchQuery) {
          tasks.push(state.searchGraph(state.searchQuery, state.selectedLabel || undefined))
        }
        await Promise.all(tasks)
      },
    }),
    {
      name: 'harbinger-knowledge-graph',
      partialize: (state) => ({
        searchQuery: state.searchQuery,
        selectedLabel: state.selectedLabel,
      }),
    }
  )
)
