import { apiClient } from './client'

// ── Findings Types ───────────────────────────────────────────────────────────

export interface FindingEvidence {
  id: string
  type: 'request' | 'response' | 'screenshot' | 'poc' | 'log' | 'code'
  title: string
  content: string
  contentType?: string
  createdAt: string
}

export interface Finding {
  id: string
  missionId?: string
  taskId?: string
  agentCodename: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  title: string
  host: string
  port?: number
  endpoint?: string
  category: string
  description: string
  evidence: FindingEvidence[]
  tool?: string
  toolOutput?: string
  cveId?: string
  cvss?: number
  confidence: 'confirmed' | 'likely' | 'possible' | 'fp'
  falsePositive: boolean
  fpReason?: string
  status: 'new' | 'triaged' | 'promoted' | 'dismissed'
  vulnId?: string
  tags?: string[]
  metadata?: Record<string, string>
  foundAt: string
  updatedAt: string
}

export interface FindingsSummary {
  total: number
  bySeverity: Record<string, number>
  byCategory: Record<string, number>
  byAgent: Record<string, number>
  falsePositive: number
}

export interface FindingsListResponse {
  ok: boolean
  findings: Finding[]
  count: number
  total: number
  summary: FindingsSummary
}

export interface FindingExport {
  missionId: string
  exportedAt: string
  summary: FindingsSummary
  findings: Finding[]
}

export interface FindingsFilters {
  severity?: string
  missionId?: string
  agent?: string
  status?: string
  category?: string
  hideFalsePositives?: boolean
}

// ── SSE Finding Event ────────────────────────────────────────────────────────

export interface FindingSSEEvent {
  id: string
  type: 'finding'
  source: string
  target: string
  channel: string
  payload: {
    findingId: string
    title: string
    severity: string
    host: string
    category: string
    agentCodename: string
    missionId?: string
    confidence: string
    action?: string
    falsePositive?: boolean
    reason?: string
  }
  timestamp: string
}

// ── API ──────────────────────────────────────────────────────────────────────

export const findingsApi = {
  list: async (filters?: FindingsFilters): Promise<Finding[]> => {
    const params: Record<string, string> = {}
    if (filters?.severity) params.severity = filters.severity
    if (filters?.missionId) params.missionId = filters.missionId
    if (filters?.agent) params.agent = filters.agent
    if (filters?.status) params.status = filters.status
    if (filters?.category) params.category = filters.category
    if (filters?.hideFalsePositives) params.hideFalsePositives = 'true'
    const result = await apiClient.get<FindingsListResponse>('/api/findings', params)
    const data = result as unknown as FindingsListResponse
    return data?.findings ?? []
  },

  create: async (finding: Partial<Finding>): Promise<Finding> => {
    const result = await apiClient.post('/api/findings', finding)
    return (result as { finding: Finding }).finding
  },

  get: async (id: string): Promise<Finding> => {
    const result = await apiClient.get(`/api/findings/${id}`)
    return (result as { finding: Finding }).finding
  },

  update: async (id: string, data: Partial<Finding>): Promise<Finding> => {
    const result = await apiClient.patch(`/api/findings/${id}`, data)
    return (result as { finding: Finding }).finding
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/findings/${id}`)
  },

  toggleFalsePositive: async (id: string, falsePositive: boolean, reason?: string): Promise<Finding> => {
    const result = await apiClient.post(`/api/findings/${id}/false-positive`, { falsePositive, reason })
    return (result as { finding: Finding }).finding
  },

  addEvidence: async (id: string, evidence: Partial<FindingEvidence>): Promise<FindingEvidence> => {
    const result = await apiClient.post(`/api/findings/${id}/evidence`, evidence)
    return (result as { evidence: FindingEvidence }).evidence
  },

  summary: async (missionId?: string): Promise<FindingsSummary> => {
    const params: Record<string, string> = {}
    if (missionId) params.missionId = missionId
    const result = await apiClient.get('/api/findings/summary', params)
    return (result as { summary: FindingsSummary }).summary
  },

  exportFindings: async (missionId?: string, format?: 'json' | 'csv', hideFP?: boolean): Promise<FindingExport | Blob> => {
    const params: Record<string, string> = {}
    if (missionId) params.missionId = missionId
    if (hideFP) params.hideFalsePositives = 'true'
    if (format === 'csv') {
      params.format = 'csv'
      const response = await apiClient.instance.get('/api/findings/export', {
        params,
        responseType: 'blob',
      })
      return response.data as Blob
    }
    const result = await apiClient.get('/api/findings/export', params)
    return (result as { export: FindingExport }).export
  },

  // SSE stream helper — returns EventSource for real-time findings
  createStream: (missionId?: string): EventSource => {
    const token = localStorage.getItem('harbinger-token')
    let url = '/api/findings/stream'
    const params = new URLSearchParams()
    if (missionId) params.set('missionId', missionId)
    if (token) params.set('token', token)
    if (params.toString()) url += `?${params}`
    return new EventSource(url)
  },
}
