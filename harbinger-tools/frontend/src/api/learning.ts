import { apiClient } from './client'

// ── Learning Types ────────────────────────────────────────────────────────────

export interface TechniqueScore {
  id: string
  techniqueId: string
  techniqueName: string
  platform: string
  successCount: number
  failureCount: number
  detectionCount: number
  successRate: number
  detectionRate: number
  avgExecutionTime: number
  lastUsed: string
  tags: string[]
  notes: string
}

export interface CampaignRecord {
  id: string
  name: string
  operationId: string
  status: 'planning' | 'active' | 'paused' | 'completed' | 'failed'
  startedAt: string
  completedAt: string
  techniquesUsed: string[]
  successfulSteps: number
  failedSteps: number
  detectedSteps: number
  totalSteps: number
  progressPercent: number
  timeline: CampaignEvent[]
  notes: string
}

export interface CampaignEvent {
  timestamp: string
  eventType: string
  techniqueId: string
  details: string
}

export interface LOLDiscovery {
  id: string
  source: string
  techniqueId: string
  binaryName: string
  platform: string
  description: string
  commands: string[]
  mitreIds: string[]
  status: 'pending_review' | 'approved' | 'rejected'
  discoveredAt: string
  reviewedAt: string
  reviewedBy: string
}

export interface AgentPerformance {
  agentId: string
  agentName: string
  totalTasks: number
  successfulTasks: number
  failedTasks: number
  avgTaskDuration: number
  techniquesKnown: number
  mostUsedTechnique: string
  bestPerformingTechnique: string
  successRate: number
  lastUpdated: string
}

export interface Recommendation {
  id: string
  type: 'technique' | 'evasion' | 'chain' | 'timing'
  title: string
  description: string
  score: number
  basedOn: string
  techniqueIds: string[]
  platform: string
  createdAt: string
}

export interface LearningDashboard {
  totalCampaigns: number
  avgSuccessRate: number
  avgDetectionRate: number
  topTechniques: TechniqueScore[]
  worstDetectionRates: TechniqueScore[]
  recentDiscoveries: LOLDiscovery[]
  totalTechniquesTracked: number
  totalAgentsTracked: number
}

// ── API ───────────────────────────────────────────────────────────────────────

export const learningApi = {
  // Technique Scores
  listTechniqueScores: async (filters?: { platform?: string; minSuccessRate?: number; sortBy?: string }) => {
    const params = new URLSearchParams()
    if (filters?.platform) params.set('platform', filters.platform)
    if (filters?.minSuccessRate !== undefined) params.set('minSuccessRate', String(filters.minSuccessRate))
    if (filters?.sortBy) params.set('sortBy', filters.sortBy)
    const result = await apiClient.get(`/api/learning/techniques?${params}`)
    return Array.isArray(result) ? result as TechniqueScore[] : []
  },

  getTechniqueScore: async (id: string) => {
    return apiClient.get(`/api/learning/techniques/${id}`) as Promise<TechniqueScore>
  },

  recordTechniqueResult: async (id: string, result: { success: boolean; detected: boolean; executionTime: number; notes?: string }) => {
    return apiClient.post(`/api/learning/techniques/${id}/result`, result)
  },

  resetTechniqueScore: async (id: string) => {
    return apiClient.delete(`/api/learning/techniques/${id}`)
  },

  // Campaigns
  listCampaigns: async (filters?: { status?: string }) => {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    const result = await apiClient.get(`/api/learning/campaigns?${params}`)
    return Array.isArray(result) ? result as CampaignRecord[] : []
  },

  getCampaign: async (id: string) => {
    return apiClient.get(`/api/learning/campaigns/${id}`) as Promise<CampaignRecord>
  },

  createCampaign: async (campaign: Partial<CampaignRecord>) => {
    return apiClient.post('/api/learning/campaigns', campaign)
  },

  updateCampaign: async (id: string, updates: Partial<CampaignRecord>) => {
    return apiClient.patch(`/api/learning/campaigns/${id}`, updates)
  },

  addCampaignEvent: async (id: string, event: Partial<CampaignEvent>) => {
    return apiClient.post(`/api/learning/campaigns/${id}/events`, event)
  },

  getCampaignStats: async (id: string) => {
    return apiClient.get(`/api/learning/campaigns/${id}/stats`)
  },

  // LOL Discoveries
  listDiscoveries: async (filters?: { status?: string; source?: string }) => {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    if (filters?.source) params.set('source', filters.source)
    const result = await apiClient.get(`/api/learning/discoveries?${params}`)
    return Array.isArray(result) ? result as LOLDiscovery[] : []
  },

  createDiscovery: async (discovery: Partial<LOLDiscovery>) => {
    return apiClient.post('/api/learning/discoveries', discovery)
  },

  reviewDiscovery: async (id: string, review: { status: 'approved' | 'rejected'; reviewedBy: string }) => {
    return apiClient.patch(`/api/learning/discoveries/${id}/review`, review)
  },

  // Agent Performance
  listAgentPerformance: async () => {
    const result = await apiClient.get('/api/learning/agents')
    return Array.isArray(result) ? result as AgentPerformance[] : []
  },

  getAgentPerformance: async (id: string) => {
    return apiClient.get(`/api/learning/agents/${id}`) as Promise<AgentPerformance>
  },

  recordAgentTask: async (id: string, task: { techniqueId: string; success: boolean; duration: number; detected: boolean }) => {
    return apiClient.post(`/api/learning/agents/${id}/tasks`, task)
  },

  // Dashboard
  getDashboard: async () => {
    return apiClient.get('/api/learning/dashboard') as Promise<LearningDashboard>
  },

  // Recommendations
  listRecommendations: async (filters?: { type?: string; platform?: string }) => {
    const params = new URLSearchParams()
    if (filters?.type) params.set('type', filters.type)
    if (filters?.platform) params.set('platform', filters.platform)
    const result = await apiClient.get(`/api/learning/recommendations?${params}`)
    return Array.isArray(result) ? result as Recommendation[] : []
  },

  generateRecommendations: async () => {
    return apiClient.post('/api/learning/recommendations/generate', {})
  },

  dismissRecommendation: async (id: string) => {
    return apiClient.delete(`/api/learning/recommendations/${id}`)
  },
}
