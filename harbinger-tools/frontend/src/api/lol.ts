import { apiClient } from './client'

// ── LOL Types ───────────────────────────────────────────────────────────────

export interface LOLProject {
  id: string
  name: string
  shortName: string
  description: string
  url: string
  githubUrl?: string
  platform: 'windows' | 'linux' | 'macos' | 'esxi' | 'cross' | 'ad' | 'cloud' | 'hardware'
  category: 'binaries' | 'drivers' | 'scripts' | 'c2' | 'persistence' | 'evasion' | 'tools' | 'apis' | 'hardware' | 'detection' | 'rmm'
  dataFormat?: string
  entryCount: number
  icon?: string
}

export interface LOLCommand {
  command: string
  description: string
  usecase?: string
  category?: string
  privileges?: string
  mitreId?: string
  os?: string
}

export interface LOLDetection {
  type: 'sigma' | 'elastic' | 'splunk' | 'ioc' | 'yara'
  name?: string
  value: string
  url?: string
}

export interface LOLEntry {
  id: string
  projectId: string
  name: string
  description: string
  platform: string
  category: string
  mitreIds: string[]
  commands: LOLCommand[]
  functions?: string[]
  paths?: string[]
  detection?: LOLDetection[]
  resources?: string[]
  tags: string[]
  hashes?: Record<string, string>
  metadata?: Record<string, string>
}

export interface LOLChainStep {
  order: number
  entryId: string
  entryName: string
  projectId: string
  commandIdx: number
  description?: string
  mitreId?: string
  tactic?: string
}

export interface LOLChain {
  id: string
  name: string
  description?: string
  platform: string
  steps: LOLChainStep[]
  mitreTactics: string[]
  createdAt: string
}

export interface LOLStats {
  totalProjects: number
  totalEntries: number
  byProject: Record<string, number>
  byPlatform: Record<string, number>
  byCategory: Record<string, number>
  mitreHeatmap: Record<string, number>
  topBinaries: string[]
}

// ── API Client ──────────────────────────────────────────────────────────────

export const lolApi = {
  // Stats
  async getStats(): Promise<LOLStats> {
    return apiClient.get('/api/lol/stats')
  },

  // Projects
  async listProjects(): Promise<LOLProject[]> {
    const result = await apiClient.get('/api/lol/projects')
    return Array.isArray(result) ? result : []
  },

  async getProject(id: string): Promise<LOLProject> {
    return apiClient.get(`/api/lol/projects/${id}`)
  },

  // Entries
  async listEntries(filters?: {
    projectId?: string
    platform?: string
    category?: string
    tag?: string
    mitreId?: string
  }): Promise<LOLEntry[]> {
    const result = await apiClient.get('/api/lol/entries', filters as Record<string, unknown>)
    return Array.isArray(result) ? result : []
  },

  async getEntry(id: string): Promise<LOLEntry> {
    return apiClient.get(`/api/lol/entries/${id}`)
  },

  async addEntry(data: Partial<LOLEntry>): Promise<{ ok: boolean; entry: LOLEntry }> {
    return apiClient.post('/api/lol/entries', data)
  },

  // Search
  async search(query: string): Promise<{ ok: boolean; results: LOLEntry[]; count: number }> {
    return apiClient.get('/api/lol/search', { q: query })
  },

  // MITRE mapping
  async getByMitre(): Promise<Record<string, LOLEntry[]>> {
    return apiClient.get('/api/lol/mitre')
  },

  // Chains
  async listChains(): Promise<LOLChain[]> {
    const result = await apiClient.get('/api/lol/chains')
    return Array.isArray(result) ? result : []
  },

  async createChain(data: Partial<LOLChain>): Promise<{ ok: boolean; chain: LOLChain }> {
    return apiClient.post('/api/lol/chains', data)
  },

  async getChain(id: string): Promise<LOLChain> {
    return apiClient.get(`/api/lol/chains/${id}`)
  },

  async deleteChain(id: string): Promise<{ ok: boolean }> {
    return apiClient.delete(`/api/lol/chains/${id}`)
  },
}
