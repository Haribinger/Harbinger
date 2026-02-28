import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { c2Api } from '../api/c2'
import type { C2Framework, C2Listener, C2Payload, C2Implant, C2Task, C2Operation, C2AttackChain, C2Dashboard } from '../api/c2'

interface C2State {
  dashboard: C2Dashboard | null
  frameworks: C2Framework[]
  listeners: C2Listener[]
  payloads: C2Payload[]
  implants: C2Implant[]
  tasks: C2Task[]
  operations: C2Operation[]
  chains: C2AttackChain[]
  isLoading: boolean
  error: string | null

  // Filters
  selectedFramework: string
  selectedImplant: string

  // Actions
  setFilter: (key: 'selectedFramework' | 'selectedImplant', value: string) => void
  fetchDashboard: () => Promise<void>
  fetchFrameworks: () => Promise<void>
  createFramework: (data: Partial<C2Framework>) => Promise<void>
  deleteFramework: (id: string) => Promise<void>
  connectFramework: (id: string) => Promise<void>
  fetchListeners: (frameworkId?: string) => Promise<void>
  createListener: (data: Partial<C2Listener>) => Promise<void>
  deleteListener: (id: string) => Promise<void>
  fetchPayloads: (frameworkId?: string) => Promise<void>
  createPayload: (data: Partial<C2Payload>) => Promise<void>
  fetchImplants: (filters?: { frameworkId?: string; status?: string }) => Promise<void>
  killImplant: (id: string) => Promise<void>
  fetchTasks: (implantId?: string) => Promise<void>
  createTask: (data: Partial<C2Task>) => Promise<void>
  fetchOperations: () => Promise<void>
  createOperation: (data: Partial<C2Operation>) => Promise<void>
  updateOperation: (id: string, data: Partial<C2Operation>) => Promise<void>
  fetchChains: (operationId?: string) => Promise<void>
  createChain: (data: Partial<C2AttackChain>) => Promise<void>
  executeChain: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

export const useC2Store = create<C2State>()(
  persist(
    (set, get) => ({
      dashboard: null,
      frameworks: [],
      listeners: [],
      payloads: [],
      implants: [],
      tasks: [],
      operations: [],
      chains: [],
      isLoading: false,
      error: null,
      selectedFramework: '',
      selectedImplant: '',

      setFilter: (key, value) => set({ [key]: value }),

      fetchDashboard: async () => {
        try {
          const data = await c2Api.getDashboard()
          set({ dashboard: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch C2 dashboard' })
        }
      },

      fetchFrameworks: async () => {
        set({ isLoading: true, error: null })
        try {
          const data = await c2Api.listFrameworks()
          set({ frameworks: data, isLoading: false })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch frameworks', isLoading: false })
        }
      },

      createFramework: async (data) => {
        try {
          await c2Api.createFramework(data)
          get().fetchFrameworks()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to create framework' })
        }
      },

      deleteFramework: async (id) => {
        try {
          await c2Api.deleteFramework(id)
          get().fetchFrameworks()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to delete framework' })
        }
      },

      connectFramework: async (id) => {
        try {
          await c2Api.connectFramework(id)
          get().fetchFrameworks()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to connect framework' })
        }
      },

      fetchListeners: async (frameworkId) => {
        try {
          const data = await c2Api.listListeners(frameworkId)
          set({ listeners: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch listeners' })
        }
      },

      createListener: async (data) => {
        try {
          await c2Api.createListener(data)
          get().fetchListeners(get().selectedFramework || undefined)
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to create listener' })
        }
      },

      deleteListener: async (id) => {
        try {
          await c2Api.deleteListener(id)
          get().fetchListeners(get().selectedFramework || undefined)
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to delete listener' })
        }
      },

      fetchPayloads: async (frameworkId) => {
        try {
          const data = await c2Api.listPayloads(frameworkId)
          set({ payloads: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch payloads' })
        }
      },

      createPayload: async (data) => {
        try {
          await c2Api.createPayload(data)
          get().fetchPayloads(get().selectedFramework || undefined)
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to create payload' })
        }
      },

      fetchImplants: async (filters) => {
        set({ isLoading: true })
        try {
          const data = await c2Api.listImplants(filters)
          set({ implants: data, isLoading: false })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch implants', isLoading: false })
        }
      },

      killImplant: async (id) => {
        try {
          await c2Api.killImplant(id)
          get().fetchImplants()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to kill implant' })
        }
      },

      fetchTasks: async (implantId) => {
        try {
          const data = await c2Api.listTasks(implantId)
          set({ tasks: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch tasks' })
        }
      },

      createTask: async (data) => {
        try {
          await c2Api.createTask(data)
          get().fetchTasks(get().selectedImplant || undefined)
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to create task' })
        }
      },

      fetchOperations: async () => {
        try {
          const data = await c2Api.listOperations()
          set({ operations: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch operations' })
        }
      },

      createOperation: async (data) => {
        try {
          await c2Api.createOperation(data)
          get().fetchOperations()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to create operation' })
        }
      },

      updateOperation: async (id, data) => {
        try {
          await c2Api.updateOperation(id, data)
          get().fetchOperations()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to update operation' })
        }
      },

      fetchChains: async (operationId) => {
        try {
          const data = await c2Api.listChains(operationId)
          set({ chains: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch chains' })
        }
      },

      createChain: async (data) => {
        try {
          await c2Api.createChain(data)
          get().fetchChains()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to create chain' })
        }
      },

      executeChain: async (id) => {
        try {
          await c2Api.executeChain(id)
          get().fetchChains()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to execute chain' })
        }
      },

      refresh: async () => {
        const state = get()
        await Promise.all([
          state.fetchDashboard(),
          state.fetchFrameworks(),
          state.fetchImplants(),
          state.fetchOperations(),
          state.fetchChains(),
        ])
      },
    }),
    {
      name: 'harbinger-c2',
      partialize: (state) => ({
        selectedFramework: state.selectedFramework,
        selectedImplant: state.selectedImplant,
      }),
    }
  )
)
