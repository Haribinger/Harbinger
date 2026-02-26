import { apiClient } from './client'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: string
  agentId?: string
  toolCalls?: Array<{
    id: string
    name: string
    arguments: Record<string, unknown>
  }>
  toolResults?: Array<{
    toolCallId: string
    output: string
  }>
}

export interface ChatSession {
  id: string
  title: string
  agentId?: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export interface SendMessageRequest {
  content: string
  agentId?: string
  sessionId?: string
  stream?: boolean
}

export const chatApi = {
  // Get all chat sessions
  getSessions: async (): Promise<ChatSession[]> => {
    return apiClient.get<ChatSession[]>('/api/chat/sessions')
  },

  // Get single session with messages
  getSession: async (id: string): Promise<ChatSession> => {
    return apiClient.get<ChatSession>(`/api/chat/sessions/${id}`)
  },

  // Create new session
  createSession: async (agentId?: string, title?: string): Promise<ChatSession> => {
    return apiClient.post<ChatSession>('/api/chat/sessions', { agentId, title })
  },

  // Delete session
  deleteSession: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/chat/sessions/${id}`)
  },

  // Send message (non-streaming)
  sendMessage: async (data: SendMessageRequest): Promise<ChatMessage> => {
    return apiClient.post<ChatMessage>('/api/chat/message', data)
  },

  // Send message with streaming
  sendMessageStream: async (
    data: SendMessageRequest,
    onChunk: (chunk: string) => void,
    onDone: () => void,
    onError: (error: Error) => void
  ): Promise<void> => {
    const response = await fetch(`${apiClient.instance.getUri()}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('harbinger-token') || ''}`,
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      onError(new Error(`HTTP ${response.status}: ${response.statusText}`))
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      onError(new Error('No response body'))
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const content = line.slice(6)
            if (content === '[DONE]') {
              onDone()
              return
            }
            try {
              const parsed = JSON.parse(content)
              if (parsed.content) {
                onChunk(parsed.content)
              }
            } catch {
              // Not JSON, treat as raw content
              onChunk(content)
            }
          }
        }
      }
    } catch (error) {
      onError(error as Error)
    } finally {
      reader.releaseLock()
    }
  },

  // Clear session messages
  clearSession: async (id: string): Promise<void> => {
    await apiClient.post(`/api/chat/sessions/${id}/clear`)
  },
}
