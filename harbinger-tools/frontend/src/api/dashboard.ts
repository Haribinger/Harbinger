import { apiClient } from './client'

export interface ActivityItem {
  id: string
  action: string
  target: string
  type: 'docker' | 'agent' | 'browser' | 'workflow' | 'mcp' | 'system'
  timestamp: string
  status?: 'success' | 'error' | 'warning' | 'info'
  user?: string
  metadata?: Record<string, unknown>
}

export interface SystemStats {
  agents: {
    total: number
    online: number
    offline: number
    busy: number
  }
  containers: {
    total: number
    running: number
    stopped: number
  }
  browsers: {
    total: number
    active: number
  }
  workflows: {
    total: number
    running: number
    completed: number
    failed: number
  }
}

export interface ServiceHealth {
  name: string
  status: 'connected' | 'disconnected' | 'error'
  port?: number
  url?: string
  latency?: number
  lastCheck?: string
  error?: string
}

export const dashboardApi = {
  // Get system stats
  getStats: async (): Promise<SystemStats> => {
    return apiClient.get<SystemStats>('/api/dashboard/stats')
  },

  // Get recent activity
  getActivity: async (limit?: number): Promise<ActivityItem[]> => {
    const result = await apiClient.get<unknown>('/api/dashboard/activity', { limit })
    return Array.isArray(result) ? result : []
  },

  // Get service health
  getServiceHealth: async (): Promise<ServiceHealth[]> => {
    const result = await apiClient.get<unknown>('/api/dashboard/health')
    return Array.isArray(result) ? result : []
  },

  // Get quick actions
  getQuickActions: async (): Promise<Array<{
    id: string
    label: string
    description: string
    icon: string
    route: string
    color: string
  }>> => {
    return apiClient.get('/api/dashboard/quick-actions')
  },
}
