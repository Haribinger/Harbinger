import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safetyApi } from '../api/safety'
import type { SafetyDashboard, ValidationRule, ScopeRule, ScopeCheckResult, RateLimitConfig, RateLimitStatus, AuditEntry, ApprovalRequest, TargetValidation } from '../api/safety'

interface SafetyState {
  dashboard: SafetyDashboard | null
  validationRules: ValidationRule[]
  scopeRules: ScopeRule[]
  rateLimits: (RateLimitConfig & RateLimitStatus)[]
  auditEntries: AuditEntry[]
  approvals: ApprovalRequest[]
  pendingCount: number
  lastValidation: TargetValidation | null
  lastScopeCheck: ScopeCheckResult | null
  isLoading: boolean
  error: string | null

  // Filters
  selectedSeverity: string
  selectedApprovalStatus: string

  // Actions
  setFilter: (key: 'selectedSeverity' | 'selectedApprovalStatus', value: string) => void
  fetchDashboard: () => Promise<void>
  validateTarget: (target: string) => Promise<TargetValidation | null>
  fetchValidationRules: () => Promise<void>
  addValidationRule: (rule: Partial<ValidationRule>) => Promise<void>
  deleteValidationRule: (id: string) => Promise<void>
  fetchScopeRules: () => Promise<void>
  createScopeRule: (rule: Partial<ScopeRule>) => Promise<void>
  updateScopeRule: (id: string, updates: Partial<ScopeRule>) => Promise<void>
  deleteScopeRule: (id: string) => Promise<void>
  checkScope: (target: string, port?: number) => Promise<ScopeCheckResult | null>
  fetchRateLimits: () => Promise<void>
  setRateLimit: (config: Partial<RateLimitConfig>) => Promise<void>
  deleteRateLimit: (id: string) => Promise<void>
  fetchAuditEntries: (filters?: { userId?: string; action?: string; severity?: string; offset?: number; limit?: number }) => Promise<void>
  fetchApprovals: (filters?: { status?: string }) => Promise<void>
  createApproval: (request: Partial<ApprovalRequest>) => Promise<void>
  reviewApproval: (id: string, review: { status: 'approved' | 'rejected'; reviewedBy: string }) => Promise<void>
  fetchPendingCount: () => Promise<void>
  refresh: () => Promise<void>
}

export const useSafetyStore = create<SafetyState>()(
  persist(
    (set, get) => ({
      dashboard: null,
      validationRules: [],
      scopeRules: [],
      rateLimits: [],
      auditEntries: [],
      approvals: [],
      pendingCount: 0,
      lastValidation: null,
      lastScopeCheck: null,
      isLoading: false,
      error: null,
      selectedSeverity: '',
      selectedApprovalStatus: '',

      setFilter: (key, value) => set({ [key]: value }),

      fetchDashboard: async () => {
        try {
          const data = await safetyApi.getDashboard()
          set({ dashboard: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch safety dashboard' })
        }
      },

      validateTarget: async (target) => {
        try {
          const data = await safetyApi.validateTarget(target)
          set({ lastValidation: data })
          return data
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to validate target' })
          return null
        }
      },

      fetchValidationRules: async () => {
        try {
          const data = await safetyApi.listValidationRules()
          set({ validationRules: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch validation rules' })
        }
      },

      addValidationRule: async (rule) => {
        try {
          await safetyApi.addValidationRule(rule)
          get().fetchValidationRules()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to add validation rule' })
        }
      },

      deleteValidationRule: async (id) => {
        try {
          await safetyApi.deleteValidationRule(id)
          get().fetchValidationRules()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to delete validation rule' })
        }
      },

      fetchScopeRules: async () => {
        try {
          const data = await safetyApi.listScopeRules()
          set({ scopeRules: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch scope rules' })
        }
      },

      createScopeRule: async (rule) => {
        try {
          await safetyApi.createScopeRule(rule)
          get().fetchScopeRules()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to create scope rule' })
        }
      },

      updateScopeRule: async (id, updates) => {
        try {
          await safetyApi.updateScopeRule(id, updates)
          get().fetchScopeRules()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to update scope rule' })
        }
      },

      deleteScopeRule: async (id) => {
        try {
          await safetyApi.deleteScopeRule(id)
          get().fetchScopeRules()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to delete scope rule' })
        }
      },

      checkScope: async (target, port) => {
        try {
          const data = await safetyApi.checkScope(target, port)
          set({ lastScopeCheck: data })
          return data
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to check scope' })
          return null
        }
      },

      fetchRateLimits: async () => {
        try {
          const data = await safetyApi.listRateLimits()
          set({ rateLimits: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch rate limits' })
        }
      },

      setRateLimit: async (config) => {
        try {
          await safetyApi.setRateLimit(config)
          get().fetchRateLimits()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to set rate limit' })
        }
      },

      deleteRateLimit: async (id) => {
        try {
          await safetyApi.deleteRateLimit(id)
          get().fetchRateLimits()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to delete rate limit' })
        }
      },

      fetchAuditEntries: async (filters) => {
        set({ isLoading: true })
        try {
          const data = await safetyApi.listAuditEntries(filters)
          set({ auditEntries: data, isLoading: false })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch audit entries', isLoading: false })
        }
      },

      fetchApprovals: async (filters) => {
        try {
          const data = await safetyApi.listApprovals(filters)
          set({ approvals: data })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch approvals' })
        }
      },

      createApproval: async (request) => {
        try {
          await safetyApi.createApproval(request)
          get().fetchApprovals()
          get().fetchPendingCount()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to create approval' })
        }
      },

      reviewApproval: async (id, review) => {
        try {
          await safetyApi.reviewApproval(id, review)
          get().fetchApprovals()
          get().fetchPendingCount()
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to review approval' })
        }
      },

      fetchPendingCount: async () => {
        try {
          const data = await safetyApi.getPendingCount()
          set({ pendingCount: data.count })
        } catch (err: unknown) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch pending count' })
        }
      },

      refresh: async () => {
        const state = get()
        await Promise.all([
          state.fetchDashboard(),
          state.fetchValidationRules(),
          state.fetchScopeRules(),
          state.fetchRateLimits(),
          state.fetchAuditEntries({ limit: 50 }),
          state.fetchApprovals(),
          state.fetchPendingCount(),
        ])
      },
    }),
    {
      name: 'harbinger-safety',
      partialize: (state) => ({
        selectedSeverity: state.selectedSeverity,
        selectedApprovalStatus: state.selectedApprovalStatus,
      }),
    }
  )
)
