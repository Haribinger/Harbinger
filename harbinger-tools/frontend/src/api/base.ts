// API Base configuration — empty string uses relative URLs (via Vite proxy in dev, nginx in prod)
export const API_BASE = (import.meta as any).env.VITE_API_URL || ''

// Helper function for API calls
export async function apiFetch<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  }

  // Add auth token if available
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('harbinger-token')
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}
