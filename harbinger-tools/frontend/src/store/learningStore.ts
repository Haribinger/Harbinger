import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { learningApi } from '../api/learning'
import type { TechniqueScore, CampaignRecord, CampaignEvent, LOLDiscovery, AgentPerformance, Recommendation, LearningDashboard } from '../api/learning'

interface LearningState {
  dashboard: LearningDashboard | null
  techniqueScores: TechniqueScore[]
  campaigns: CampaignRecord[]
  discoveries: LOLDiscovery[]
  agentPerformance: AgentPerformance[]
  recommendations: Recommendation[]
  isLoading: boolean
  error: string | null

  // Filters
  selectedPlatform: string
  selectedCampaignStatus: string

  // Actions
  setFilter: (key: 'selectedPlatform' | 'selectedCampaignStatus', value: string) => void
  fetchDashboard: () => Promise<void>
  fetchTechniqueScores: (filters?: { platform?: string; minSuccessRate?: number; sortBy?: string }) => Promise<void>
  recordTechniqueResult: (id: string, result: { success: boolean; detected: boolean; executionTime: number; notes?: string }) => Promise<void>
  fetchCampaigns: (filters?: { status?: string }) => Promise<void>
  createCampaign: (campaign: Partial<CampaignRecord>) => Promise<void>
  updateCampaign: (id: string, updates: Partial<CampaignRecord>) => Promise<void>
  addCampaignEvent: (id: string, event: Partial<CampaignEvent>) => Promise<void>
  fetchDiscoveries: (filters?: { status?: string; source?: string }) => Promise<void>
  createDiscovery: (discovery: Partial<LOLDiscovery>) => Promise<void>
  reviewDiscovery: (id: string, review: { status: 'approved' | 'rejected'; reviewedBy: string }) => Promise<void>
  fetchAgentPerformance: () => Promise<void>
  recordAgentTask: (id: string, task: { techniqueId: string; success: boolean; duration: number; detected: boolean }) => Promise<void>
  fetchRecommendations: (filters?: { type?: string; platform?: string }) => Promise<void>
  generateRecommendations: () => Promise<void>
  dismissRecommendation: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

export const useLearningStore = create<LearningState>()(
  persist(
    (set, get) => ({
      dashboard: null,
      techniqueScores: [],
      campaigns: [],
      discoveries: [],
      agentPerformance: [],
      recommendations: [],
      isLoading: false,
      error: null,
      selectedPlatform: '',
      selectedCampaignStatus: '',

      setFilter: (key, value) => set({ [key]: value }),

      fetchDashboard: async () => {
        try {
          const data = await learningApi.getDashboard()
          set({ dashboard: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch learning dashboard' })
        }
      },

      fetchTechniqueScores: async (filters) => {
        set({ isLoading: true, error: null })
        try {
          const data = await learningApi.listTechniqueScores(filters)
          set({ techniqueScores: data, isLoading: false })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch technique scores', isLoading: false })
        }
      },

      recordTechniqueResult: async (id, result) => {
        try {
          await learningApi.recordTechniqueResult(id, result)
          get().fetchTechniqueScores()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to record result' })
        }
      },

      fetchCampaigns: async (filters) => {
        set({ isLoading: true, error: null })
        try {
          const data = await learningApi.listCampaigns(filters)
          set({ campaigns: data, isLoading: false })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch campaigns', isLoading: false })
        }
      },

      createCampaign: async (campaign) => {
        try {
          await learningApi.createCampaign(campaign)
          get().fetchCampaigns()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to create campaign' })
        }
      },

      updateCampaign: async (id, updates) => {
        try {
          await learningApi.updateCampaign(id, updates)
          get().fetchCampaigns()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to update campaign' })
        }
      },

      addCampaignEvent: async (id, event) => {
        try {
          await learningApi.addCampaignEvent(id, event)
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to add campaign event' })
        }
      },

      fetchDiscoveries: async (filters) => {
        try {
          const data = await learningApi.listDiscoveries(filters)
          set({ discoveries: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch discoveries' })
        }
      },

      createDiscovery: async (discovery) => {
        try {
          await learningApi.createDiscovery(discovery)
          get().fetchDiscoveries()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to create discovery' })
        }
      },

      reviewDiscovery: async (id, review) => {
        try {
          await learningApi.reviewDiscovery(id, review)
          get().fetchDiscoveries()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to review discovery' })
        }
      },

      fetchAgentPerformance: async () => {
        try {
          const data = await learningApi.listAgentPerformance()
          set({ agentPerformance: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch agent performance' })
        }
      },

      recordAgentTask: async (id, task) => {
        try {
          await learningApi.recordAgentTask(id, task)
          get().fetchAgentPerformance()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to record agent task' })
        }
      },

      fetchRecommendations: async (filters) => {
        try {
          const data = await learningApi.listRecommendations(filters)
          set({ recommendations: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch recommendations' })
        }
      },

      generateRecommendations: async () => {
        try {
          await learningApi.generateRecommendations()
          get().fetchRecommendations()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to generate recommendations' })
        }
      },

      dismissRecommendation: async (id) => {
        try {
          await learningApi.dismissRecommendation(id)
          get().fetchRecommendations()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to dismiss recommendation' })
        }
      },

      refresh: async () => {
        const state = get()
        await Promise.all([
          state.fetchDashboard(),
          state.fetchTechniqueScores(),
          state.fetchCampaigns(),
          state.fetchDiscoveries(),
          state.fetchAgentPerformance(),
          state.fetchRecommendations(),
        ])
      },
    }),
    {
      name: 'harbinger-learning',
      partialize: (state) => ({
        selectedPlatform: state.selectedPlatform,
        selectedCampaignStatus: state.selectedCampaignStatus,
      }),
    }
  )
)
