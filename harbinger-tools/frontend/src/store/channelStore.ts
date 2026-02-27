import { create } from 'zustand'
import { persist } from 'zustand/middleware'

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('harbinger-token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Channel types
export type ChannelType = 'discord' | 'telegram' | 'slack' | 'webchat'

export interface ChannelConfig {
  id: ChannelType
  enabled: boolean
  status: 'connected' | 'disconnected' | 'error'
  hasToken: boolean
  metadata: Record<string, string> // guildId, channelId, chatId, etc.
}

// Per-user cross-channel context
export interface UserContext {
  userId: string
  username: string
  preferredChannel: ChannelType
  responseStyle: 'brief' | 'detailed' | 'technical' | 'casual'
  lastSeen: Record<ChannelType, number> // timestamp per channel
  watchingAgents: string[] // agent IDs the user follows
  conversationHistory: ConversationEntry[]
}

export interface ConversationEntry {
  id: string
  channel: ChannelType
  agentId?: string
  agentName?: string
  userId: string
  message: string
  response?: string
  timestamp: number
}

// Agent-to-agent messages
export interface AgentMessage {
  id: string
  fromAgent: string
  fromAgentName: string
  toAgent: string | 'broadcast' // target or broadcast
  type: 'handoff' | 'finding' | 'status' | 'request' | 'context'
  content: string
  data?: Record<string, unknown>
  channel?: ChannelType // which channel triggered this
  timestamp: number
}

// Channel-formatted agent response
export interface ChannelResponse {
  agentId: string
  agentName: string
  agentPersonality: string
  channel: ChannelType
  userId: string
  message: string
  format: 'markdown' | 'html' | 'plaintext'
  attachments?: { type: string; url: string }[]
}

interface ChannelState {
  // Channel configs
  channels: Record<ChannelType, ChannelConfig>
  activeChannel: ChannelType

  // User contexts (keyed by unique user identifier)
  userContexts: Record<string, UserContext>

  // Inter-agent message bus
  agentMessages: AgentMessage[]

  // Cross-channel conversation feed (last 200)
  conversations: ConversationEntry[]

  // Actions
  fetchChannels: () => Promise<void>
  configureChannel: (channel: ChannelType, config: Partial<ChannelConfig>) => void
  testChannel: (channel: ChannelType) => Promise<boolean>
  setActiveChannel: (channel: ChannelType) => void

  // User context
  updateUserContext: (userId: string, updates: Partial<UserContext>) => void
  getUserContext: (userId: string) => UserContext | undefined
  trackUserSeen: (userId: string, channel: ChannelType) => void

  // Agent communication
  broadcastAgentMessage: (msg: Omit<AgentMessage, 'id' | 'timestamp'>) => void
  getAgentMessages: (agentId: string) => AgentMessage[]
  fetchAgentMessages: () => Promise<void>

  // Conversations
  addConversation: (entry: Omit<ConversationEntry, 'id'>) => void
  fetchConversations: () => Promise<void>

  // Channel-aware formatting
  formatForChannel: (agentName: string, message: string, channel: ChannelType) => string
}

const defaultChannels: Record<ChannelType, ChannelConfig> = {
  discord: { id: 'discord', enabled: false, status: 'disconnected', hasToken: false, metadata: {} },
  telegram: { id: 'telegram', enabled: false, status: 'disconnected', hasToken: false, metadata: {} },
  slack: { id: 'slack', enabled: false, status: 'disconnected', hasToken: false, metadata: {} },
  webchat: { id: 'webchat', enabled: true, status: 'connected', hasToken: true, metadata: {} },
}

export const useChannelStore = create<ChannelState>()(
  persist(
    (set, get) => ({
      channels: defaultChannels,
      activeChannel: 'webchat',
      userContexts: {},
      agentMessages: [],
      conversations: [],

      fetchChannels: async () => {
        try {
          const res = await fetch('/api/channels', { headers: authHeaders() })
          if (!res.ok) return
          const data = await res.json()
          set((state) => ({
            channels: {
              ...state.channels,
              discord: { ...state.channels.discord, enabled: data.discord?.enabled ?? false, status: data.discord?.status ?? 'disconnected', hasToken: data.discord?.hasToken ?? false },
              telegram: { ...state.channels.telegram, enabled: data.telegram?.enabled ?? false, status: data.telegram?.status ?? 'disconnected', hasToken: data.telegram?.hasToken ?? false },
              slack: { ...state.channels.slack, enabled: data.slack?.enabled ?? false, status: data.slack?.status ?? 'disconnected', hasToken: data.slack?.hasToken ?? false },
            },
          }))
        } catch { /* offline */ }
      },

      configureChannel: (channel, config) => {
        set((state) => ({
          channels: { ...state.channels, [channel]: { ...state.channels[channel], ...config } },
        }))
      },

      testChannel: async (channel) => {
        try {
          const res = await fetch(`/api/channels/${channel}/test`, { method: 'POST', headers: authHeaders() })
          const data = await res.json()
          set((state) => ({
            channels: {
              ...state.channels,
              [channel]: { ...state.channels[channel], status: data.ok ? 'connected' : 'error' },
            },
          }))
          return data.ok
        } catch {
          return false
        }
      },

      setActiveChannel: (channel) => set({ activeChannel: channel }),

      // User context tracking
      updateUserContext: (userId, updates) => {
        set((state) => ({
          userContexts: {
            ...state.userContexts,
            [userId]: { ...(state.userContexts[userId] || { userId, username: '', preferredChannel: 'webchat', responseStyle: 'detailed', lastSeen: {}, watchingAgents: [], conversationHistory: [] }), ...updates },
          },
        }))
      },

      getUserContext: (userId) => get().userContexts[userId],

      trackUserSeen: (userId, channel) => {
        const ctx = get().userContexts[userId]
        const lastSeen = { ...(ctx?.lastSeen || {}), [channel]: Date.now() }
        // Determine preferred channel from most recently used
        const entries = Object.entries(lastSeen).sort(([, a], [, b]) => b - a)
        const preferredChannel = (entries[0]?.[0] as ChannelType) || 'webchat'
        set((state) => ({
          userContexts: {
            ...state.userContexts,
            [userId]: {
              ...(ctx || { userId, username: '', responseStyle: 'detailed', watchingAgents: [], conversationHistory: [] }),
              lastSeen,
              preferredChannel,
            },
          },
        }))
      },

      // Agent-to-agent communication
      broadcastAgentMessage: (msg) => {
        const full: AgentMessage = {
          ...msg,
          id: `amsg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
        }
        set((state) => ({
          agentMessages: [...state.agentMessages.slice(-199), full],
        }))
        // Also POST to backend for persistence
        fetch('/api/agents/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(full),
        }).catch(() => { /* broadcast persistence to backend is best-effort */ })
      },

      getAgentMessages: (agentId) => {
        return get().agentMessages.filter(
          (m) => m.toAgent === agentId || m.toAgent === 'broadcast' || m.fromAgent === agentId
        )
      },

      fetchAgentMessages: async () => {
        try {
          const res = await fetch('/api/agents/messages', { headers: authHeaders() })
          if (!res.ok) return
          const data = await res.json()
          if (Array.isArray(data)) {
            set({ agentMessages: data.slice(-200) })
          }
        } catch { /* offline */ }
      },

      // Conversations
      addConversation: (entry) => {
        const full: ConversationEntry = {
          ...entry,
          id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        }
        set((state) => ({
          conversations: [...state.conversations.slice(-199), full],
        }))
      },

      fetchConversations: async () => {
        try {
          const res = await fetch('/api/channels/conversations', { headers: authHeaders() })
          if (!res.ok) return
          const data = await res.json()
          if (Array.isArray(data)) {
            set({ conversations: data.slice(-200) })
          }
        } catch { /* offline */ }
      },

      // Channel-aware formatting: adapt response for each platform
      formatForChannel: (agentName, message, channel) => {
        switch (channel) {
          case 'discord':
            // Discord: markdown with emoji, keep under 2000 chars
            return `**${agentName}**: ${message}`.slice(0, 2000)
          case 'telegram':
            // Telegram: HTML-style markdown with more detail
            return `*${agentName}*\n${message}`
          case 'slack':
            // Slack: mrkdwn format
            return `*${agentName}*: ${message}`
          default:
            return `${agentName}: ${message}`
        }
      },
    }),
    {
      name: 'harbinger-channels',
      partialize: (state) => ({
        userContexts: state.userContexts,
        activeChannel: state.activeChannel,
      }),
    }
  )
)
