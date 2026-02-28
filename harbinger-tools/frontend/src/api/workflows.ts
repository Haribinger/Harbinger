import { apiClient } from './client'
import type { Workflow, WorkflowNode, WorkflowEdge } from '../types'

export interface CreateWorkflowRequest {
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  currentNodeId?: string
  results: Record<string, unknown>
  logs: Array<{
    timestamp: string
    nodeId: string
    level: 'info' | 'warn' | 'error'
    message: string
  }>
}

export const workflowsApi = {
  // Get all workflows
  getAll: async (): Promise<Workflow[]> => {
    const result = await apiClient.get<unknown>('/api/workflows')
    return Array.isArray(result) ? result : (Array.isArray(result?.workflows) ? result.workflows : [])
  },

  // Get single workflow
  get: async (id: string): Promise<Workflow> => {
    return apiClient.get<Workflow>(`/api/workflows/${id}`)
  },

  // Create workflow
  create: async (data: CreateWorkflowRequest): Promise<Workflow> => {
    return apiClient.post<Workflow>('/api/workflows', data)
  },

  // Update workflow
  update: async (id: string, data: Partial<CreateWorkflowRequest>): Promise<Workflow> => {
    return apiClient.patch<Workflow>(`/api/workflows/${id}`, data)
  },

  // Delete workflow
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/workflows/${id}`)
  },

  // Run workflow
  run: async (id: string, inputs?: Record<string, unknown>): Promise<WorkflowExecution> => {
    return apiClient.post<WorkflowExecution>(`/api/workflows/${id}/run`, { inputs })
  },

  // Get workflow executions
  getExecutions: async (id: string): Promise<WorkflowExecution[]> => {
    return apiClient.get<WorkflowExecution[]>(`/api/workflows/${id}/executions`)
  },

  // Get execution details
  getExecution: async (workflowId: string, executionId: string): Promise<WorkflowExecution> => {
    return apiClient.get<WorkflowExecution>(`/api/workflows/${workflowId}/executions/${executionId}`)
  },

  // Cancel execution
  cancelExecution: async (workflowId: string, executionId: string): Promise<void> => {
    await apiClient.post(`/api/workflows/${workflowId}/executions/${executionId}/cancel`)
  },

  // Clone workflow
  clone: async (id: string, name: string): Promise<Workflow> => {
    return apiClient.post<Workflow>(`/api/workflows/${id}/clone`, { name })
  },

  // Export workflow
  export: async (id: string): Promise<string> => {
    const response = await apiClient.get<{ yaml: string }>(`/api/workflows/${id}/export`)
    return response.yaml
  },

  // Import workflow
  import: async (yaml: string): Promise<Workflow> => {
    return apiClient.post<Workflow>('/api/workflows/import', { yaml })
  },
}
