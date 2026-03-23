import { apiClient } from './client'

// ── Types ────────────────────────────────────────────────────────────────────

export interface RegistrySetting {
  key: string
  value: string | number | boolean | Record<string, unknown>
  default_value?: unknown
  source?: string
  description?: string
}

export interface AgentDefinition {
  codename: string
  display_name: string
  description: string
  tools: string[]
  docker_image: string
  model: string | null
  max_iterations: number
  enabled: boolean
  tags: string[]
}

export interface MissionTemplate {
  id: string
  name: string
  description: string
  default_autonomy: string
  continuous: boolean
  scan_interval: number
  tasks: Array<Record<string, unknown>>
}

export interface RegistryOverview {
  agents: { total: number; enabled: number }
  tools: { builtin: number; user: number; search_engines: string[] }
  templates: { total: number }
  settings: { total: number }
}

export interface ChannelAdapter {
  id: string
  name: string
  type: 'discord' | 'telegram' | 'slack' | 'teams' | 'email'
  description: string
  installed: boolean
  enabled: boolean
  icon: string
  config_fields: string[]
}

export interface Plugin {
  id: string
  name: string
  description: string
  version: string
  author: string
  installed: boolean
  enabled: boolean
  type: 'mcp' | 'tool' | 'agent' | 'skill'
  capabilities: string[]
}

// ── API ──────────────────────────────────────────────────────────────────────

const V2 = '/api/v2/registry'

export const registryApi = {
  // Overview
  getOverview: () =>
    apiClient.get<RegistryOverview>(`${V2}/overview`),

  // Settings
  listSettings: (prefix = '') =>
    apiClient.get<{ settings: Record<string, RegistrySetting> }>(`${V2}/settings`, { prefix }),

  getSetting: (key: string) =>
    apiClient.get<{ key: string; value: unknown }>(`${V2}/settings/${key}`),

  updateSetting: (key: string, value: unknown) =>
    apiClient.put(`${V2}/settings/${key}`, { value }),

  resetSetting: (key: string) =>
    apiClient.delete(`${V2}/settings/${key}`),

  // Agents
  listAgents: (enabledOnly = false) =>
    apiClient.get<{ agents: AgentDefinition[] }>(`${V2}/agents`, { enabled_only: enabledOnly }),

  getAgent: (codename: string) =>
    apiClient.get<AgentDefinition>(`${V2}/agents/${codename}`),

  updateAgent: (codename: string, updates: Partial<AgentDefinition>) =>
    apiClient.put(`${V2}/agents/${codename}`, updates),

  createAgent: (agent: Omit<AgentDefinition, 'enabled' | 'tags'> & { tags?: string[] }) =>
    apiClient.post(`${V2}/agents`, agent),

  deleteAgent: (codename: string) =>
    apiClient.delete(`${V2}/agents/${codename}`),

  // Templates
  listTemplates: () =>
    apiClient.get<{ templates: MissionTemplate[] }>(`${V2}/templates`),

  createTemplate: (template: Omit<MissionTemplate, 'id'> & { id: string }) =>
    apiClient.post(`${V2}/templates`, template),

  deleteTemplate: (id: string) =>
    apiClient.delete(`${V2}/templates/${id}`),
}
