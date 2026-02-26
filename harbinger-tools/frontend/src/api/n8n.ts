// n8n API client
const env = (import.meta as any).env || {}
const N8N_API_BASE_URL = env.VITE_N8N_API_BASE_URL || '/api/n8n'
const N8N_API_KEY = env.VITE_N8N_API_KEY || ''

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (N8N_API_KEY) h['X-N8N-API-KEY'] = N8N_API_KEY
  // Attach Harbinger JWT for proxied requests
  const token = localStorage.getItem('harbinger-token')
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

export const listWorkflows = async () => {
  const response = await fetch(`${N8N_API_BASE_URL}/workflows`, {
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error(`n8n: HTTP ${response.status}`)
  }
  const data = await response.json()
  return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
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
