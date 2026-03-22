import { apiClient } from './client'

export interface VulnEvidence {
  id: string
  type: 'screenshot' | 'request' | 'response' | 'code' | 'poc' | 'log'
  title: string
  content: string
  contentType?: string
  createdAt: string
}

export interface Vulnerability {
  id: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  status: 'new' | 'triaged' | 'in_progress' | 'remediated' | 'verified' | 'accepted_risk'
  cveId?: string
  cvss?: number
  target: string
  endpoint?: string
  category: string
  description: string
  impact?: string
  remediation?: string
  evidence: VulnEvidence[]
  agentId?: string
  agentName?: string
  tags?: string[]
  foundAt: string
  updatedAt: string
  slaDeadline?: string
}

export interface VulnSummary {
  critical: number
  high: number
  medium: number
  low: number
  info: number
}

export const vulnsApi = {
  async list(filters?: { severity?: string; status?: string }): Promise<{ ok: boolean; vulns: Vulnerability[]; count: number; total: number; summary: VulnSummary }> {
    const params = new URLSearchParams()
    if (filters?.severity) params.set('severity', filters.severity)
    if (filters?.status) params.set('status', filters.status)
    const qs = params.toString()
    return apiClient.get(`/api/vulns${qs ? '?' + qs : ''}`)
  },

  async get(id: string): Promise<{ ok: boolean; vuln: Vulnerability }> {
    return apiClient.get(`/api/vulns/${id}`)
  },

  async create(data: Partial<Vulnerability>): Promise<{ ok: boolean; vuln: Vulnerability }> {
    return apiClient.post('/api/vulns', data)
  },

  async update(id: string, data: Partial<Vulnerability>): Promise<{ ok: boolean; vuln: Vulnerability }> {
    return apiClient.patch(`/api/vulns/${id}`, data)
  },

  async delete(id: string): Promise<{ ok: boolean }> {
    return apiClient.delete(`/api/vulns/${id}`)
  },

  async addEvidence(vulnId: string, evidence: Partial<VulnEvidence>): Promise<{ ok: boolean; evidence: VulnEvidence }> {
    return apiClient.post(`/api/vulns/${vulnId}/evidence`, evidence)
  },
}
