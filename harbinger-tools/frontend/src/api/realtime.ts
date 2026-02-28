import { apiClient } from './client'

// ── Realtime Types ────────────────────────────────────────────────────────────

export interface RealtimeEvent {
  id: string
  type: 'agent_status' | 'command_output' | 'implant_callback' | 'chain_progress' | 'operator_action' | 'system_alert'
  source: string
  target: string
  payload: Record<string, unknown>
  timestamp: string
}

export interface AgentLiveStatus {
  agentId: string
  agentName: string
  status: 'idle' | 'executing' | 'waiting' | 'error'
  currentTask: string
  currentChain: string
  lastHeartbeat: string
  metrics: Record<string, unknown>
}

export interface CommandStream {
  id: string
  implantId: string
  command: string
  status: 'queued' | 'executing' | 'completed' | 'failed'
  output: string
  startedAt: string
  completedAt: string
}

export interface OperatorSession {
  id: string
  userId: string
  username: string
  role: 'admin' | 'operator' | 'observer'
  activeSince: string
  lastAction: string
  currentView: string
}

export interface KillSwitchState {
  active: boolean
}

// ── API ───────────────────────────────────────────────────────────────────────

export const realtimeApi = {
  // Events
  listEvents: async (filters?: { type?: string; limit?: number }) => {
    const params = new URLSearchParams()
    if (filters?.type) params.set('type', filters.type)
    if (filters?.limit) params.set('limit', String(filters.limit))
    const result = await apiClient.get(`/api/realtime/events?${params}`)
    return Array.isArray(result) ? result as RealtimeEvent[] : []
  },

  broadcastEvent: async (event: Partial<RealtimeEvent>) => {
    return apiClient.post('/api/realtime/events', event)
  },

  // Agent Status
  getAgentStatuses: async () => {
    const result = await apiClient.get('/api/realtime/agents')
    return Array.isArray(result) ? result as AgentLiveStatus[] : []
  },

  updateAgentStatus: async (id: string, status: Partial<AgentLiveStatus>) => {
    return apiClient.put(`/api/realtime/agents/${id}`, status)
  },

  agentHeartbeat: async (id: string) => {
    return apiClient.post(`/api/realtime/agents/${id}/heartbeat`, {})
  },

  // Command Streams
  listStreams: async (filters?: { implantId?: string; status?: string }) => {
    const params = new URLSearchParams()
    if (filters?.implantId) params.set('implantId', filters.implantId)
    if (filters?.status) params.set('status', filters.status)
    const result = await apiClient.get(`/api/realtime/streams?${params}`)
    return Array.isArray(result) ? result as CommandStream[] : []
  },

  createStream: async (stream: Partial<CommandStream>) => {
    return apiClient.post('/api/realtime/streams', stream)
  },

  getStream: async (id: string) => {
    return apiClient.get(`/api/realtime/streams/${id}`) as Promise<CommandStream>
  },

  appendOutput: async (id: string, output: string) => {
    return apiClient.post(`/api/realtime/streams/${id}/output`, { output })
  },

  // Operators
  listOperators: async () => {
    const result = await apiClient.get('/api/realtime/operators')
    return Array.isArray(result) ? result as OperatorSession[] : []
  },

  registerOperator: async (op: Partial<OperatorSession>) => {
    return apiClient.post('/api/realtime/operators', op)
  },

  operatorAction: async (id: string, action: string) => {
    return apiClient.post(`/api/realtime/operators/${id}/action`, { action })
  },

  kickOperator: async (id: string) => {
    return apiClient.delete(`/api/realtime/operators/${id}`)
  },

  // Kill Switch
  getKillSwitch: async () => {
    return apiClient.get('/api/realtime/killswitch') as Promise<KillSwitchState>
  },

  toggleKillSwitch: async (active: boolean) => {
    return apiClient.post('/api/realtime/killswitch', { active })
  },

  // SSE stream URL (for EventSource)
  getSSEUrl: (channel?: string) => {
    const base = '/api/realtime/stream'
    return channel ? `${base}?channel=${encodeURIComponent(channel)}` : base
  },
}
