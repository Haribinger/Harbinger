import { apiClient } from './client'

// ── Healing Types ────────────────────────────────────────────────────────────

export interface HealDiagnosis {
  reason: string
  auto_fixable: boolean
  fix_type: 'restart' | 'oom' | 'escalate'
  suggested_fix: string
  confidence: number
  model?: string
}

export interface HealingEvent {
  id: string
  type: HealingEventType
  mission_id: string
  task_id: string
  agent_codename: string
  container_id?: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  diagnosis?: HealDiagnosis
  auto_fixed: boolean
  fix_action?: string
  metadata?: Record<string, unknown>
  created_at: string
}

export type HealingEventType =
  | 'container_restart'
  | 'oom_restart'
  | 'timeout_kill'
  | 'stall_nudge'
  | 'escalation'
  | 'diagnosis'
  | 'monitor_start'
  | 'monitor_stop'

export interface HealingConfig {
  poll_interval_sec: number
  subtask_timeout_sec: number
  stall_threshold_sec: number
  max_restart_retries: number
  oom_memory_limit_mb: number
  auto_heal_enabled: boolean
  llm_diag_enabled: boolean
}

export interface HealingStats {
  total_events: number
  events_by_type: Record<string, number>
  events_by_severity: Record<string, number>
  auto_fixed_count: number
  escalation_count: number
  monitor_running: boolean
  last_poll_at: string
  active_missions: number
  watched_containers: number
}

export interface HealingStatus {
  running: boolean
  last_poll_at: string
  config: HealingConfig
}

// ── API Client ───────────────────────────────────────────────────────────────

export const healingApi = {
  // Events
  listEvents: async (filters?: { type?: string; severity?: string; limit?: number }) => {
    const params = new URLSearchParams()
    if (filters?.type) params.set('type', filters.type)
    if (filters?.severity) params.set('severity', filters.severity)
    if (filters?.limit) params.set('limit', String(filters.limit))
    const query = params.toString()
    const result = await apiClient.get(`/api/healing/events${query ? `?${query}` : ''}`)
    return result as { ok: boolean; events: HealingEvent[]; total: number }
  },

  getEvent: async (id: string) => {
    const result = await apiClient.get(`/api/healing/events/${id}`)
    return result as { ok: boolean; event: HealingEvent }
  },

  // Stats
  getStats: async () => {
    const result = await apiClient.get('/api/healing/stats')
    return result as { ok: boolean; stats: HealingStats }
  },

  // Monitor control
  getStatus: async () => {
    const result = await apiClient.get('/api/healing/status')
    return result as { ok: boolean } & HealingStatus
  },

  startMonitor: async () => {
    const result = await apiClient.post('/api/healing/start', {})
    return result as { ok: boolean; message: string }
  },

  stopMonitor: async () => {
    const result = await apiClient.post('/api/healing/stop', {})
    return result as { ok: boolean; message: string }
  },

  // Config
  getConfig: async () => {
    const result = await apiClient.get('/api/healing/config')
    return result as { ok: boolean; config: HealingConfig }
  },

  updateConfig: async (config: Partial<HealingConfig>) => {
    const result = await apiClient.post('/api/healing/config', config)
    return result as { ok: boolean; config: HealingConfig }
  },
}
