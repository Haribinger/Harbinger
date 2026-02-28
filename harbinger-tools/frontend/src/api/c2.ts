import { apiClient } from './client'

// ── C2 Types ────────────────────────────────────────────────────────────────

export interface C2Framework {
  id: string
  name: string
  type: 'mythic' | 'sliver' | 'havoc' | 'cobalt_strike' | 'custom'
  url: string
  status: 'connected' | 'disconnected' | 'error'
  version?: string
  listeners: C2Listener[]
  implantCount: number
  metadata?: Record<string, string>
  createdAt: string
  lastSeen?: string
}

export interface C2Listener {
  id: string
  frameworkId: string
  name: string
  type: 'http' | 'https' | 'tcp' | 'smb' | 'dns' | 'named_pipe' | 'websocket'
  bindAddress: string
  bindPort: number
  status: 'active' | 'stopped' | 'error'
  protocol?: string
  profile?: string
  createdAt: string
}

export interface C2Payload {
  id: string
  frameworkId: string
  name: string
  type: 'exe' | 'dll' | 'shellcode' | 'ps1' | 'hta' | 'msi' | 'office_macro' | 'iso'
  platform: 'windows' | 'linux' | 'macos' | 'cross'
  arch: 'x64' | 'x86' | 'arm64'
  format: 'raw' | 'base64' | 'hex' | 'csharp' | 'python'
  listenerId: string
  size: number
  hash?: string
  evasion: string[]
  status: 'generating' | 'ready' | 'error'
  createdAt: string
}

export interface C2Implant {
  id: string
  frameworkId: string
  hostname: string
  username: string
  ip: string
  externalIp?: string
  os: string
  arch: string
  pid: number
  process: string
  integrity: 'system' | 'high' | 'medium' | 'low'
  status: 'active' | 'dormant' | 'dead' | 'initializing'
  sleep: number
  jitter: number
  lastCheckIn: string
  firstSeen: string
  tags: string[]
}

export interface C2Task {
  id: string
  implantId: string
  command: string
  args?: string
  status: 'queued' | 'dispatched' | 'running' | 'completed' | 'failed'
  output?: string
  error?: string
  operator: string
  issuedAt: string
  completedAt?: string
}

export interface C2Operation {
  id: string
  name: string
  description?: string
  status: 'planning' | 'active' | 'paused' | 'completed'
  objective?: string
  frameworkIds: string[]
  agentIds: string[]
  mitreTactics: string[]
  startedAt: string
  completedAt?: string
}

export interface C2AttackStep {
  id: string
  order: number
  name: string
  description: string
  type: 'lolbin' | 'c2_command' | 'script' | 'manual'
  command?: string
  lolEntryId?: string
  mitreId?: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  output?: string
  implantId?: string
}

export interface C2AttackChain {
  id: string
  operationId: string
  name: string
  steps: C2AttackStep[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  createdAt: string
}

export interface C2Dashboard {
  frameworks: number
  listeners: number
  activeImplants: number
  totalTasks: number
  operations: number
  attackChains: number
  byFramework: Record<string, number>
  byPlatform: Record<string, number>
  recentTasks: C2Task[]
}

export interface C2SearchResult {
  type: 'framework' | 'implant' | 'task'
  id: string
  name: string
  data: C2Framework | C2Implant | C2Task
}

// ── API Client ──────────────────────────────────────────────────────────────

export const c2Api = {
  // Dashboard
  async getDashboard(): Promise<C2Dashboard> {
    return apiClient.get('/api/c2/dashboard')
  },

  // Frameworks
  async listFrameworks(): Promise<C2Framework[]> {
    const result = await apiClient.get('/api/c2/frameworks')
    return Array.isArray(result) ? result : []
  },

  async createFramework(data: Partial<C2Framework>): Promise<{ ok: boolean; framework: C2Framework }> {
    return apiClient.post('/api/c2/frameworks', data)
  },

  async getFramework(id: string): Promise<C2Framework> {
    return apiClient.get(`/api/c2/frameworks/${id}`)
  },

  async deleteFramework(id: string): Promise<{ ok: boolean }> {
    return apiClient.delete(`/api/c2/frameworks/${id}`)
  },

  async connectFramework(id: string): Promise<{ ok: boolean; framework: C2Framework }> {
    return apiClient.post(`/api/c2/frameworks/${id}/connect`)
  },

  // Listeners
  async listListeners(frameworkId?: string): Promise<C2Listener[]> {
    const params = frameworkId ? { frameworkId } : undefined
    const result = await apiClient.get('/api/c2/listeners', params)
    return Array.isArray(result) ? result : []
  },

  async createListener(data: Partial<C2Listener>): Promise<{ ok: boolean; listener: C2Listener }> {
    return apiClient.post('/api/c2/listeners', data)
  },

  async deleteListener(id: string): Promise<{ ok: boolean }> {
    return apiClient.delete(`/api/c2/listeners/${id}`)
  },

  // Payloads
  async listPayloads(frameworkId?: string): Promise<C2Payload[]> {
    const params = frameworkId ? { frameworkId } : undefined
    const result = await apiClient.get('/api/c2/payloads', params)
    return Array.isArray(result) ? result : []
  },

  async createPayload(data: Partial<C2Payload>): Promise<{ ok: boolean; payload: C2Payload }> {
    return apiClient.post('/api/c2/payloads', data)
  },

  // Implants
  async listImplants(filters?: { frameworkId?: string; status?: string }): Promise<C2Implant[]> {
    const result = await apiClient.get('/api/c2/implants/managed', filters as Record<string, unknown>)
    return Array.isArray(result) ? result : []
  },

  async createImplant(data: Partial<C2Implant>): Promise<{ ok: boolean; implant: C2Implant }> {
    return apiClient.post('/api/c2/implants/managed', data)
  },

  async getImplant(id: string): Promise<C2Implant> {
    return apiClient.get(`/api/c2/implants/managed/${id}`)
  },

  async killImplant(id: string): Promise<{ ok: boolean }> {
    return apiClient.post(`/api/c2/implants/managed/${id}/kill`)
  },

  // Tasks
  async listTasks(implantId?: string): Promise<C2Task[]> {
    const params = implantId ? { implantId } : undefined
    const result = await apiClient.get('/api/c2/tasks', params)
    return Array.isArray(result) ? result : []
  },

  async createTask(data: Partial<C2Task>): Promise<{ ok: boolean; task: C2Task }> {
    return apiClient.post('/api/c2/tasks', data)
  },

  async completeTask(id: string, data: { output?: string; error?: string; status?: string }): Promise<{ ok: boolean; task: C2Task }> {
    return apiClient.post(`/api/c2/tasks/${id}/complete`, data)
  },

  // Operations
  async listOperations(): Promise<C2Operation[]> {
    const result = await apiClient.get('/api/c2/operations')
    return Array.isArray(result) ? result : []
  },

  async createOperation(data: Partial<C2Operation>): Promise<{ ok: boolean; operation: C2Operation }> {
    return apiClient.post('/api/c2/operations', data)
  },

  async updateOperation(id: string, data: Partial<C2Operation>): Promise<{ ok: boolean; operation: C2Operation }> {
    return apiClient.patch(`/api/c2/operations/${id}`, data)
  },

  // Attack Chains
  async listChains(operationId?: string): Promise<C2AttackChain[]> {
    const params = operationId ? { operationId } : undefined
    const result = await apiClient.get('/api/c2/chains', params)
    return Array.isArray(result) ? result : []
  },

  async createChain(data: Partial<C2AttackChain>): Promise<{ ok: boolean; chain: C2AttackChain }> {
    return apiClient.post('/api/c2/chains', data)
  },

  async executeChain(id: string): Promise<{ ok: boolean; chain: C2AttackChain }> {
    return apiClient.post(`/api/c2/chains/${id}/execute`)
  },

  async updateChainStep(chainId: string, stepId: string, data: { status: string; output?: string }): Promise<{ ok: boolean; chain: C2AttackChain }> {
    return apiClient.patch(`/api/c2/chains/${chainId}/steps/${stepId}`, data)
  },

  // Search
  async search(query: string): Promise<{ ok: boolean; results: C2SearchResult[]; count: number }> {
    return apiClient.get('/api/c2/search', { q: query })
  },
}
