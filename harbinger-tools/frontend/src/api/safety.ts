import { apiClient } from './client'

// ── Safety Types ──────────────────────────────────────────────────────────────

export interface TargetValidation {
  id: string
  target: string
  type: 'ip' | 'hostname' | 'cidr' | 'url'
  status: 'allowed' | 'blocked' | 'requires_approval'
  reason: string
  validatedAt: string
  validatedBy: string
  expiresAt: string
}

export interface ValidationRule {
  id: string
  name: string
  type: 'allow' | 'block'
  target: string
  description: string
  builtIn: boolean
  createdAt: string
}

export interface ScopeRule {
  id: string
  name: string
  type: 'include' | 'exclude'
  target: string
  description: string
  createdAt: string
  createdBy: string
  active: boolean
}

export interface ScopeCheckResult {
  allowed: boolean
  matchedRule: string
  reason: string
}

export interface RateLimitConfig {
  id: string
  operationType: string
  maxPerMinute: number
  maxPerHour: number
  maxConcurrent: number
  active: boolean
}

export interface RateLimitStatus {
  operationType: string
  currentMinute: number
  currentHour: number
  currentConcurrent: number
  isLimited: boolean
}

export interface AuditEntry {
  id: string
  timestamp: string
  userId: string
  username: string
  action: string
  resource: string
  resourceId: string
  details: Record<string, unknown>
  severity: 'info' | 'warning' | 'critical'
  ipAddress: string
}

export interface ApprovalRequest {
  id: string
  type: string
  title: string
  description: string
  requestedBy: string
  requestedAt: string
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  reviewedBy: string
  reviewedAt: string
  expiresAt: string
  metadata: Record<string, unknown>
}

export interface SafetyDashboard {
  killSwitchActive: boolean
  pendingApprovals: number
  rateLimitStatuses: RateLimitStatus[]
  scopeRuleCount: number
  recentAuditEntries: AuditEntry[]
  recentValidationFailures: TargetValidation[]
}

// ── API ───────────────────────────────────────────────────────────────────────

export const safetyApi = {
  // Dashboard
  getDashboard: async () => {
    return apiClient.get('/api/safety/dashboard') as Promise<SafetyDashboard>
  },

  // Target Validation
  validateTarget: async (target: string) => {
    return apiClient.post('/api/safety/validate', { target }) as Promise<TargetValidation>
  },

  listValidationRules: async () => {
    const result = await apiClient.get('/api/safety/rules')
    return Array.isArray(result) ? result as ValidationRule[] : []
  },

  addValidationRule: async (rule: Partial<ValidationRule>) => {
    return apiClient.post('/api/safety/rules', rule)
  },

  deleteValidationRule: async (id: string) => {
    return apiClient.delete(`/api/safety/rules/${id}`)
  },

  // Scope
  listScopeRules: async () => {
    const result = await apiClient.get('/api/safety/scope')
    return Array.isArray(result) ? result as ScopeRule[] : []
  },

  createScopeRule: async (rule: Partial<ScopeRule>) => {
    return apiClient.post('/api/safety/scope', rule)
  },

  updateScopeRule: async (id: string, updates: Partial<ScopeRule>) => {
    return apiClient.patch(`/api/safety/scope/${id}`, updates)
  },

  deleteScopeRule: async (id: string) => {
    return apiClient.delete(`/api/safety/scope/${id}`)
  },

  checkScope: async (target: string, port?: number) => {
    return apiClient.post('/api/safety/scope/check', { target, port }) as Promise<ScopeCheckResult>
  },

  getScopeStats: async () => {
    return apiClient.get('/api/safety/scope/stats')
  },

  // Rate Limits
  listRateLimits: async () => {
    const result = await apiClient.get('/api/safety/rate-limits')
    return Array.isArray(result) ? result as (RateLimitConfig & RateLimitStatus)[] : []
  },

  setRateLimit: async (config: Partial<RateLimitConfig>) => {
    return apiClient.post('/api/safety/rate-limits', config)
  },

  deleteRateLimit: async (id: string) => {
    return apiClient.delete(`/api/safety/rate-limits/${id}`)
  },

  checkRateLimit: async (operationType: string) => {
    return apiClient.post('/api/safety/rate-limits/check', { operationType }) as Promise<RateLimitStatus>
  },

  // Audit
  listAuditEntries: async (filters?: { userId?: string; action?: string; severity?: string; from?: string; to?: string; offset?: number; limit?: number }) => {
    const params = new URLSearchParams()
    if (filters?.userId) params.set('userId', filters.userId)
    if (filters?.action) params.set('action', filters.action)
    if (filters?.severity) params.set('severity', filters.severity)
    if (filters?.from) params.set('from', filters.from)
    if (filters?.to) params.set('to', filters.to)
    if (filters?.offset !== undefined) params.set('offset', String(filters.offset))
    if (filters?.limit !== undefined) params.set('limit', String(filters.limit))
    const result = await apiClient.get(`/api/safety/audit?${params}`)
    return Array.isArray(result) ? result as AuditEntry[] : []
  },

  getAuditStats: async () => {
    return apiClient.get('/api/safety/audit/stats')
  },

  exportAudit: async () => {
    const result = await apiClient.get('/api/safety/audit/export')
    return Array.isArray(result) ? result as AuditEntry[] : []
  },

  // Approvals
  listApprovals: async (filters?: { status?: string }) => {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    const result = await apiClient.get(`/api/safety/approvals?${params}`)
    return Array.isArray(result) ? result as ApprovalRequest[] : []
  },

  createApproval: async (request: Partial<ApprovalRequest>) => {
    return apiClient.post('/api/safety/approvals', request)
  },

  reviewApproval: async (id: string, review: { status: 'approved' | 'rejected'; reviewedBy: string }) => {
    return apiClient.patch(`/api/safety/approvals/${id}`, review)
  },

  getPendingCount: async () => {
    return apiClient.get('/api/safety/approvals/pending/count') as Promise<{ count: number }>
  },
}
