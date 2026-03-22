import { apiClient } from './client'

// ── Agent Shell Types ────────────────────────────────────────────────────────

export interface ShellSession {
  id: string
  agent_id: string
  agent_name: string
  container_id: string
  user_id: string
  status: 'active' | 'closed'
  created_at: string
  last_command: string
  command_count: number
}

export interface TerminalLogEntry {
  id: string
  session_id: string
  stream: 'stdin' | 'stdout' | 'stderr'
  content: string
  timestamp: string
}

export interface ShellStreamChunk {
  stream: 'stdout' | 'stderr'
  data: string
  ts: string
  replay?: boolean
}

export interface ShellExecDone {
  type: 'done'
  exit_code: number
}

// ── API Functions ────────────────────────────────────────────────────────────

export async function attachShell(agent: string): Promise<ShellSession> {
  const result = await apiClient.post<{ ok: boolean; session: ShellSession }>('/api/shell/attach', { agent })
  return result.session
}

export async function listShellSessions(): Promise<ShellSession[]> {
  const result = await apiClient.get<{ ok: boolean; sessions: ShellSession[] }>('/api/shell/sessions')
  return result.sessions || []
}

export async function getShellSession(id: string): Promise<{ session: ShellSession; logs: TerminalLogEntry[] }> {
  return apiClient.get<{ ok: boolean; session: ShellSession; logs: TerminalLogEntry[] }>(`/api/shell/${id}`)
}

export async function closeShellSession(id: string): Promise<void> {
  await apiClient.delete(`/api/shell/${id}`)
}

export async function getShellHistory(id: string): Promise<TerminalLogEntry[]> {
  const result = await apiClient.get<{ ok: boolean; logs: TerminalLogEntry[] }>(`/api/shell/${id}/history`)
  return result.logs || []
}

/**
 * Execute a command in a shell session and stream output via SSE.
 * Returns an EventSource-like interface for consuming chunks.
 */
export function execShellCommand(
  sessionId: string,
  command: string,
  onChunk: (chunk: ShellStreamChunk) => void,
  onDone: (exitCode: number) => void,
  onError: (error: string) => void,
  options?: { workdir?: string; timeout?: number }
): AbortController {
  const controller = new AbortController()

  const token = localStorage.getItem('harbinger-token') || (() => {
    try {
      const persisted = localStorage.getItem('harbinger-auth')
      if (persisted) {
        const parsed = JSON.parse(persisted)
        return parsed?.state?.token || ''
      }
    } catch { /* ignore */ }
    return ''
  })()

  fetch(`/api/shell/${sessionId}/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      command,
      workdir: options?.workdir,
      timeout: options?.timeout,
    }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'unknown error' }))
        onError(body.error || `HTTP ${response.status}`)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        onError('no response body')
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE frames
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6)
          try {
            const parsed = JSON.parse(jsonStr)
            if (parsed.type === 'done') {
              onDone(parsed.exit_code)
            } else {
              onChunk(parsed as ShellStreamChunk)
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err.message)
      }
    })

  return controller
}

/**
 * Open a read-only SSE stream for watching a session's output.
 * Returns a cleanup function.
 */
export function watchShellStream(
  sessionId: string,
  onChunk: (chunk: ShellStreamChunk) => void,
): () => void {
  const token = localStorage.getItem('harbinger-token') || ''
  const es = new EventSource(`/api/shell/${sessionId}/stream?token=${token}`)

  es.onmessage = (event) => {
    try {
      const chunk = JSON.parse(event.data) as ShellStreamChunk
      onChunk(chunk)
    } catch {
      // Skip malformed
    }
  }

  es.onerror = () => {
    // EventSource auto-reconnects
  }

  return () => es.close()
}
