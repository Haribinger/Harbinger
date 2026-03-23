import { apiClient } from './client'

// ── Types ────────────────────────────────────────────────────────────────────

export type TrustTier = 'builtin' | 'verified' | 'community' | 'unknown' | 'restricted'

export interface CatalogEntry {
  id: string
  name: string
  description: string
  author: string
  repo: string
  docker_image: string
  integration_type: 'roar' | 'mcp' | 'docker'
  capabilities: string[]
  roar_endpoint: string | null
  mcp_endpoint: string | null
  trust_tier: TrustTier
  min_harbinger_version: string
  installed: boolean
}

export interface ActiveAgent {
  codename: string
  did: string
  display_name: string
  status: 'idle' | 'executing' | 'waiting' | 'error' | 'offline'
  trust_tier: TrustTier
  trust_score: number
  current_task: string | null
  last_heartbeat: string | null
  capabilities: string[]
  docker_image: string
  model: string | null
  tasks_completed: number
  tasks_failed: number
  integration_type: 'builtin' | 'roar' | 'mcp'
}

export interface FeedEvent {
  id: string
  type: string
  from_agent: string
  to_agent: string
  intent: string
  payload: Record<string, unknown>
  timestamp: number
}

export interface TrustConfig {
  codename: string
  trust_tier: TrustTier
  trust_score: number
  auto_approve: boolean
  max_autonomy: number
}

export interface HubOverview {
  total_agents: number
  builtin: number
  external: number
  mcp_tools: number
  online: number
  executing: number
}

export interface MCPTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface TrustRanking {
  codename: string
  effective_score: number
  base_score: number
  performance_bonus: number
  failure_penalty: number
}

// ── API ──────────────────────────────────────────────────────────────────────

const V2 = '/api/v2/hub'

export const hubApi = {
  // Overview
  getOverview: () =>
    apiClient.get<HubOverview>(`${V2}/overview`).catch(() => ({
      total_agents: 0, builtin: 0, external: 0, mcp_tools: 0, online: 0, executing: 0,
    } as HubOverview)),

  // Catalog
  getCatalog: (capability?: string) => {
    const params = capability ? { capability } : undefined
    return apiClient.get<CatalogEntry[]>(`${V2}/catalog`, params).catch(() => [])
  },

  getCatalogEntry: (id: string) =>
    apiClient.get<CatalogEntry>(`${V2}/catalog/${id}`),

  install: (catalogId: string) =>
    apiClient.post<{ ok: boolean; agent: ActiveAgent }>(`${V2}/install`, { catalog_id: catalogId }),

  installCustom: (data: {
    docker_image: string
    name: string
    capabilities: string[]
    integration_type: 'roar' | 'mcp'
    roar_endpoint?: string
    mcp_endpoint?: string
  }) =>
    apiClient.post<{ ok: boolean; agent: ActiveAgent }>(`${V2}/install/custom`, data),

  // Active agents
  listAgents: () =>
    apiClient.get<ActiveAgent[]>(`${V2}/agents`).catch(() => []),

  getAgent: (codename: string) =>
    apiClient.get<ActiveAgent>(`${V2}/agents/${codename}`),

  killAgent: (codename: string) =>
    apiClient.post(`${V2}/agents/${codename}/kill`),

  restartAgent: (codename: string) =>
    apiClient.post(`${V2}/agents/${codename}/restart`),

  // Uninstall
  uninstall: (codename: string) =>
    apiClient.delete(`${V2}/agents/${codename}`),

  // Trust
  listTrust: () =>
    apiClient.get<TrustConfig[]>(`${V2}/trust`).catch(() => []),

  getTrust: (codename: string) =>
    apiClient.get<TrustConfig>(`${V2}/trust/${codename}`),

  updateTrustTier: (codename: string, tier: TrustTier) =>
    apiClient.put(`${V2}/trust/${codename}/tier`, { tier }),

  approveAgent: (codename: string) =>
    apiClient.post(`${V2}/trust/${codename}/approve`),

  rankAgents: (capability: string, limit = 5) =>
    apiClient.post<TrustRanking[]>(`${V2}/trust/rank`, { capability, limit }),

  // Sync
  syncRegistries: () =>
    apiClient.post<{ synced: number; created: number; removed: number }>(`${V2}/sync`),

  // MCP Bridge
  listMCPAgents: () =>
    apiClient.get<ActiveAgent[]>(`${V2}/mcp`).catch(() => []),

  callMCPTool: (agentId: string, toolName: string, args: Record<string, unknown>) =>
    apiClient.post(`${V2}/mcp/${agentId}/call`, { tool_name: toolName, args }),

  listMCPTools: (agentId: string) =>
    apiClient.get<MCPTool[]>(`${V2}/mcp/${agentId}/tools`).catch(() => []),

  // Command bar (absorbs OpenClaw)
  sendCommand: (command: string) =>
    apiClient.post<{ ok: boolean; response: unknown }>(`${V2}/command`, { command, channel: 'web' })
      .catch(() => apiClient.post<unknown>('/api/openclaw/command', { command, channel: 'web' })),
}
