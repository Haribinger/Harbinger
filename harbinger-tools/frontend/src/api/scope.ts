import { apiClient } from './client'

export interface ScopeAsset {
  id: string
  pattern: string
  type: 'Wildcard' | 'Web App' | 'CIDR' | 'API' | 'Mobile'
  tags: string[]
  addedBy?: string
  createdAt: string
}

export interface ScopeExclusion {
  id: string
  pattern: string
  reason: string
  tags: string[]
  addedBy?: string
  createdAt: string
}

export const scopeApi = {
  async getAssets(): Promise<{ ok: boolean; assets: ScopeAsset[]; count: number }> {
    return apiClient.get('/api/scope/assets')
  },

  async addAsset(data: { pattern: string; type?: string; tags?: string[] }): Promise<{ ok: boolean; asset: ScopeAsset }> {
    return apiClient.post('/api/scope/assets', data)
  },

  async deleteAsset(id: string): Promise<{ ok: boolean }> {
    return apiClient.delete(`/api/scope/assets/${id}`)
  },

  async bulkImport(text: string, target: 'in-scope' | 'exclusion'): Promise<{ ok: boolean; added: number }> {
    return apiClient.post('/api/scope/assets/bulk', { text, target })
  },

  async getExclusions(): Promise<{ ok: boolean; exclusions: ScopeExclusion[]; count: number }> {
    return apiClient.get('/api/scope/exclusions')
  },

  async addExclusion(data: { pattern: string; reason: string; tags?: string[] }): Promise<{ ok: boolean; exclusion: ScopeExclusion }> {
    return apiClient.post('/api/scope/exclusions', data)
  },

  async deleteExclusion(id: string): Promise<{ ok: boolean }> {
    return apiClient.delete(`/api/scope/exclusions/${id}`)
  },

  async exportScope(): Promise<{ ok: boolean; assets: ScopeAsset[]; exclusions: ScopeExclusion[]; exportedAt: string }> {
    return apiClient.get('/api/scope/export')
  },
}
