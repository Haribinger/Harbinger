import { apiClient } from './client'

// ── Types ────────────────────────────────────────────────────────────────────

export interface EfficiencyScore {
  time_saved: number
  frequency: number
  implementation_cost: number
  running_cost: number
  cost_benefit: number
  automation_type: 'script' | 'skill' | 'workflow' | 'code_change'
}

export interface AgentThought {
  id: string
  agent_id: string
  agent_name: string
  type: 'observation' | 'enhancement' | 'proposal' | 'alert'
  category: 'performance' | 'accuracy' | 'cost' | 'automation' | 'collaboration' | ''
  title: string
  content: string
  priority: number
  status: 'pending' | 'approved' | 'rejected' | 'implemented'
  efficiency?: EfficiencyScore
  data?: unknown
  created_at: number
}

export interface SwarmAgentStatus {
  id: string
  name: string
  type: string
  status: string
  current_task?: string
  thought_count: number
}

export interface SwarmState {
  agents: SwarmAgentStatus[]
  active_thoughts: number
  pending_proposals: number
  system_health: 'healthy' | 'degraded' | 'critical'
  timestamp: number
}

export interface AutonomousStats {
  total_thoughts: number
  active_thoughts: number
  pending_proposals: number
  implemented_count: number
  avg_efficiency: number
  automations_by_type: Record<string, number>
  thoughts_by_agent: Record<string, number>
  thoughts_by_category: Record<string, number>
}

// ── API Client ───────────────────────────────────────────────────────────────

export const autonomousApi = {
  createThought: async (thought: Partial<AgentThought>) => {
    return apiClient.post<{ ok: boolean; thought: AgentThought }>(
      '/api/autonomous/thoughts',
      thought
    )
  },

  listThoughts: async (filters?: {
    agent_id?: string
    type?: string
    status?: string
    category?: string
    limit?: number
  }) => {
    const params: Record<string, unknown> = {}
    if (filters?.agent_id) params.agent_id = filters.agent_id
    if (filters?.type) params.type = filters.type
    if (filters?.status) params.status = filters.status
    if (filters?.category) params.category = filters.category
    if (filters?.limit) params.limit = filters.limit
    return apiClient.get<{ ok: boolean; thoughts: AgentThought[]; count: number }>(
      '/api/autonomous/thoughts',
      params
    )
  },

  getThought: async (id: string) => {
    return apiClient.get<{ ok: boolean; thought: AgentThought }>(
      `/api/autonomous/thoughts/${id}`
    )
  },

  updateThought: async (id: string, status: AgentThought['status']) => {
    return apiClient.patch<{ ok: boolean; thought: AgentThought }>(
      `/api/autonomous/thoughts/${id}`,
      { status }
    )
  },

  deleteThought: async (id: string) => {
    return apiClient.delete<{ ok: boolean }>(
      `/api/autonomous/thoughts/${id}`
    )
  },

  getSwarmState: async () => {
    return apiClient.get<{ ok: boolean; swarm: SwarmState }>(
      '/api/autonomous/swarm'
    )
  },

  getStats: async () => {
    return apiClient.get<{ ok: boolean; stats: AutonomousStats }>(
      '/api/autonomous/stats'
    )
  },
}
