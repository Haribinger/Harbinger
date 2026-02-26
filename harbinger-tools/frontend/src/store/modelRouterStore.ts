import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiClient } from '../api/client'

export interface ModelRoute {
  task_type: string
  default_provider: string
  fallback_provider: string
  model: string
  fallback_model: string
  max_tokens: number
  cost_optimize: boolean
}

export interface ModelRouterConfig {
  local_mode: boolean
  auto_classify: boolean
  default_provider: string
  cost_optimization: boolean
}

interface ModelRouterState {
  routes: ModelRoute[]
  config: ModelRouterConfig
  isLoading: boolean
  error: string | null

  fetchRoutes: () => Promise<void>
  updateRoutes: (routes: ModelRoute[], config?: ModelRouterConfig) => Promise<void>
  updateRoute: (index: number, update: Partial<ModelRoute>) => void
  toggleLocalMode: () => Promise<void>
  setDefaultProvider: (provider: string) => void
  resolveModel: (task: string, agentId?: string) => Promise<{ provider: string; model: string; complexity: string } | null>
}

export const useModelRouterStore = create<ModelRouterState>()(
  persist(
    (set, get) => ({
      routes: [],
      config: {
        local_mode: false,
        auto_classify: true,
        default_provider: 'ollama',
        cost_optimization: true,
      },
      isLoading: false,
      error: null,

      fetchRoutes: async () => {
        set({ isLoading: true, error: null })
        try {
          const data = await apiClient.get<{ ok: boolean; routes: ModelRoute[]; config: ModelRouterConfig }>(
            '/api/settings/model-routes'
          )
          set({
            routes: data.routes || [],
            config: data.config || get().config,
            isLoading: false,
          })
        } catch (err: any) {
          set({ error: err.message || 'Failed to fetch model routes', isLoading: false })
        }
      },

      updateRoutes: async (routes, config) => {
        const body: any = { routes }
        if (config) body.config = config
        try {
          await apiClient.put('/api/settings/model-routes', body)
          set({ routes, ...(config ? { config } : {}) })
        } catch (err: any) {
          set({ error: err.message || 'Failed to update routes' })
        }
      },

      updateRoute: (index, update) => {
        const routes = [...get().routes]
        if (routes[index]) {
          routes[index] = { ...routes[index], ...update }
          set({ routes })
        }
      },

      toggleLocalMode: async () => {
        const newConfig = { ...get().config, local_mode: !get().config.local_mode }
        set({ config: newConfig })
        try {
          await apiClient.put('/api/settings/model-routes', {
            config: newConfig,
            routes: get().routes,
          })
        } catch {
          // Revert on failure
          set({ config: { ...newConfig, local_mode: !newConfig.local_mode } })
        }
      },

      setDefaultProvider: (provider) => {
        set({ config: { ...get().config, default_provider: provider } })
      },

      resolveModel: async (task, agentId) => {
        try {
          const data = await apiClient.post<{
            ok: boolean
            provider: string
            model: string
            complexity: string
          }>('/api/model-routes/resolve', { task, agent_id: agentId })
          return { provider: data.provider, model: data.model, complexity: data.complexity }
        } catch {
          return null
        }
      },
    }),
    {
      name: 'harbinger-model-router',
      partialize: (state) => ({
        config: state.config,
        routes: state.routes,
      }),
    }
  )
)
