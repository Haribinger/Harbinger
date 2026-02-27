import { apiClient } from './client'

export interface CVEEntry {
  cveID: string
  vendorProject: string
  product: string
  vulnerabilityName: string
  dateAdded: string
  shortDescription: string
  requiredAction: string
  dueDate: string
  knownRansomwareCampaignUse: string
}

export interface CVEFeedResponse {
  ok: boolean
  count: number
  totalInCatalog?: number
  catalogVersion?: string
  vulnerabilities: CVEEntry[]
  cachedAt?: string
  stale?: boolean
}

export interface CVEMatch {
  cve: CVEEntry
  target: string
  reason: string
}

export const cveApi = {
  getFeed: async (vendor?: string): Promise<CVEFeedResponse> => {
    const params = vendor ? `?vendor=${encodeURIComponent(vendor)}` : ''
    return apiClient.get<CVEFeedResponse>(`/api/cve/feed${params}`)
  },

  getMatching: async (): Promise<{ ok: boolean; matches: CVEMatch[]; count: number }> => {
    return apiClient.get<{ ok: boolean; matches: CVEMatch[]; count: number }>('/api/cve/matching')
  },

  refresh: async (): Promise<{ ok: boolean; count: number }> => {
    return apiClient.post<{ ok: boolean; count: number }>('/api/cve/refresh', {})
  },
}
