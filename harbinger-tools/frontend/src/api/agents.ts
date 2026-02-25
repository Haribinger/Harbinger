import { apiClient } from './client'
import type { Agent, AgentPersonality } from '../types'

export interface CreateAgentRequest {
  name: string
  description?: string
  personalityId?: string
  model?: string
  provider?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  tools?: string[]
}

export interface AgentResponse extends Agent {
  lastActivity?: string
  stats?: {
    messagesSent: number
    tokensUsed: number
    tasksCompleted: number
  }
}

export const agentsApi = {
  // Get all agents
  getAll: async (): Promise<AgentResponse[]> => {
    const result = await apiClient.get<any>('/api/agents')
    return Array.isArray(result) ? result : (Array.isArray(result?.agents) ? result.agents : [])
  },

  // Get single agent
  get: async (id: string): Promise<AgentResponse> => {
    return apiClient.get<AgentResponse>(`/api/agents/${id}`)
  },

  // Create agent
  create: async (data: CreateAgentRequest): Promise<AgentResponse> => {
    return apiClient.post<AgentResponse>('/api/agents', data)
  },

  // Update agent
  update: async (id: string, data: Partial<CreateAgentRequest>): Promise<AgentResponse> => {
    return apiClient.patch<AgentResponse>(`/api/agents/${id}`, data)
  },

  // Delete agent
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/agents/${id}`)
  },

  // Set agent status
  setStatus: async (id: string, status: Agent['status']): Promise<void> => {
    await apiClient.patch(`/api/agents/${id}/status`, { status })
  },

  // Get agent personalities
  getPersonalities: async (): Promise<AgentPersonality[]> => {
    return apiClient.get<AgentPersonality[]>('/api/agents/personalities')
  },

  // Create personality
  createPersonality: async (data: Omit<AgentPersonality, 'id'>): Promise<AgentPersonality> => {
    return apiClient.post<AgentPersonality>('/api/agents/personalities', data)
  },

  // Clone agent
  clone: async (id: string, name: string): Promise<AgentResponse> => {
    return apiClient.post<AgentResponse>(`/api/agents/${id}/clone`, { name })
  },
}
