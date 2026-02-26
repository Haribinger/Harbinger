import { apiClient } from './client'

export interface HealthMetric {
  date: string
  any_types: number
  console_logs: number
  test_coverage: number
  deps_outdated: number
  conventions: number
  score: number
}

export interface HealthIssue {
  file: string
  line: number
  message: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  date: string
}

export interface CurrentHealth {
  latest: HealthMetric | null
  previous: HealthMetric | null
  score: number
  recent_issues: HealthIssue[]
}

export const codeHealthApi = {
  getHistory: async (range: 'week' | 'month' | 'quarter' = 'month') => {
    const data = await apiClient.get<{ ok: boolean; range: string; metrics: HealthMetric[] }>(
      `/api/health/code?range=${range}`
    )
    return data
  },

  getCurrent: async () => {
    const data = await apiClient.get<{ ok: boolean; current: CurrentHealth }>(
      '/api/health/current'
    )
    return data
  },

  postUpdate: async (metric: Partial<HealthMetric>) => {
    const data = await apiClient.post<{ ok: boolean; metric: HealthMetric }>(
      '/api/health/code',
      metric
    )
    return data
  },
}
