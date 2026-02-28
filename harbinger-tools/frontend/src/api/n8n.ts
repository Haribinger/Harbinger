// n8n API client — Vite exposes env vars on import.meta.env
const viteEnv = (import.meta as { env?: Record<string, string> }).env ?? {}
const N8N_API_BASE_URL = viteEnv.VITE_N8N_API_BASE_URL || '/api/n8n'
const N8N_API_KEY = viteEnv.VITE_N8N_API_KEY || ''

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (N8N_API_KEY) h['X-N8N-API-KEY'] = N8N_API_KEY
  // Attach Harbinger JWT for proxied requests
  const token = localStorage.getItem('harbinger-token')
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

export interface N8NWorkflow {
  id: string
  name: string
  active?: boolean
  [key: string]: unknown
}

export const listWorkflows = async (): Promise<N8NWorkflow[]> => {
  const response = await fetch(`${N8N_API_BASE_URL}/workflows`, {
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error(`n8n: HTTP ${response.status}`)
  }
  const data = await response.json()
  const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
  return items as N8NWorkflow[]
}

export const triggerWorkflow = async (workflowId: string, data?: unknown) => {
  const response = await fetch(`${N8N_API_BASE_URL}/workflows/${workflowId}/start`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error(`n8n trigger: HTTP ${response.status}`)
  }
  return response.json()
}

export const getExecutionStatus = async (executionId: string) => {
  const response = await fetch(`${N8N_API_BASE_URL}/executions/${executionId}`, {
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error(`n8n execution: HTTP ${response.status}`)
  }
  return response.json()
}
