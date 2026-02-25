import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Agent, AgentPersonality, Message, ChatSession } from '../types'

interface AgentState {
  agents: Agent[]
  personalities: AgentPersonality[]
  activeAgent: Agent | null
  chats: ChatSession[]
  activeChat: ChatSession | null
  isLoading: boolean
  error: string | null

  // Actions
  setAgents: (agents: Agent[]) => void
  addAgent: (agent: Agent) => void
  updateAgent: (id: string, updates: Partial<Agent>) => void
  removeAgent: (id: string) => void
  setActiveAgent: (agent: Agent | null) => void

  setPersonalities: (personalities: AgentPersonality[]) => void
  addPersonality: (personality: AgentPersonality) => void
  removePersonality: (id: string) => void

  setChats: (chats: ChatSession[]) => void
  addChat: (chat: ChatSession) => void
  updateChat: (id: string, updates: Partial<ChatSession>) => void
  removeChat: (id: string) => void
  setActiveChat: (chat: ChatSession | null) => void
  addMessage: (chatId: string, message: Message) => void

  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set) => ({
      agents: [],
      personalities: [
        {
          id: 'default',
          name: 'Default Assistant',
          description: 'A helpful AI assistant',
          systemPrompt: 'You are a helpful AI assistant. Be concise and clear.',
          temperature: 0.7,
          maxTokens: 4096,
        },
        {
          id: 'security-expert',
          name: 'Security Expert',
          description: 'Expert in cybersecurity and penetration testing',
          systemPrompt: `You are an expert in cybersecurity and penetration testing.
You provide detailed technical analysis and security recommendations.
Always consider the security implications of your actions.`,
          temperature: 0.5,
          maxTokens: 8192,
        },
        {
          id: 'bug-bounty-hunter',
          name: 'Bug Bounty Hunter',
          description: 'Expert in finding and exploiting vulnerabilities',
          systemPrompt: `You are an expert bug bounty hunter specializing in web application security.
You excel at finding and exploiting vulnerabilities responsibly.
Always document your findings with clear reproduction steps and impact assessment.`,
          temperature: 0.6,
          maxTokens: 8192,
        },
        {
          id: 'code-reviewer',
          name: 'Code Reviewer',
          description: 'Senior software engineer focused on code quality',
          systemPrompt: `You are a senior software engineer with expertise in code review.
You focus on security vulnerabilities, performance issues, and code maintainability.
Provide specific line numbers and actionable suggestions.`,
          temperature: 0.4,
          maxTokens: 4096,
        },
        {
          id: 'creative-writer',
          name: 'Creative Writer',
          description: 'Imaginative writer for creative tasks',
          systemPrompt: 'You are a creative writer with a vivid imagination. Help users with storytelling, creative writing, and content creation.',
          temperature: 0.9,
          maxTokens: 4096,
        },
      ],
      activeAgent: null,
      chats: [],
      activeChat: null,
      isLoading: false,
      error: null,

      setAgents: (agents) => set({ agents }),
      addAgent: (agent) => set((state) => ({ agents: [...state.agents, agent] })),
      updateAgent: (id, updates) =>
        set((state) => ({
          agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),
      removeAgent: (id) =>
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== id),
        })),
      setActiveAgent: (agent) => set({ activeAgent: agent }),

      setPersonalities: (personalities) => set({ personalities }),
      addPersonality: (personality) =>
        set((state) => ({
          personalities: [...state.personalities, personality],
        })),
      removePersonality: (id) =>
        set((state) => ({
          personalities: state.personalities.filter((p) => p.id !== id),
        })),

      setChats: (chats) => set({ chats }),
      addChat: (chat) => set((state) => ({ chats: [...state.chats, chat] })),
      updateChat: (id, updates) =>
        set((state) => ({
          chats: state.chats.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),
      removeChat: (id) =>
        set((state) => ({
          chats: state.chats.filter((c) => c.id !== id),
        })),
      setActiveChat: (chat) => set({ activeChat: chat }),
      addMessage: (chatId, message) =>
        set((state) => ({
          chats: state.chats.map((c) =>
            c.id === chatId ? { ...c, messages: [...c.messages, message] } : c
          ),
        })),

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'harbinger-agents',
      partialize: (state) => ({
        agents: state.agents,
        personalities: state.personalities,
        chats: state.chats,
      }),
    }
  )
)
