import { create } from 'zustand'
import {
  attachShell,
  listShellSessions,
  closeShellSession,
  execShellCommand,
  type ShellSession,
  type ShellStreamChunk,
} from '../api/agentshell'

// ── Output line type ────────────────────────────────────────────────────────

export interface OutputLine {
  id: string
  stream: 'stdin' | 'stdout' | 'stderr' | 'system'
  content: string
  timestamp: string
}

// ── Store ───────────────────────────────────────────────────────────────────

interface AgentShellState {
  sessions: ShellSession[]
  activeSessionId: string | null
  outputBuffers: Record<string, OutputLine[]> // sessionId -> lines
  isExecuting: Record<string, boolean>        // sessionId -> running
  isLoading: boolean
  error: string | null

  // Actions
  fetchSessions: () => Promise<void>
  attach: (agent: string) => Promise<ShellSession | null>
  close: (sessionId: string) => Promise<void>
  setActiveSession: (sessionId: string | null) => void
  executeCommand: (sessionId: string, command: string) => AbortController | null
  clearOutput: (sessionId: string) => void
  appendOutput: (sessionId: string, line: OutputLine) => void
}

const MAX_OUTPUT_LINES = 2000

let lineCounter = 0
function genLineId(): string {
  return `line_${++lineCounter}_${Date.now()}`
}

export const useAgentShellStore = create<AgentShellState>()(
  (set, get) => ({
    sessions: [],
    activeSessionId: null,
    outputBuffers: {},
    isExecuting: {},
    isLoading: false,
    error: null,

    fetchSessions: async () => {
      try {
        set({ isLoading: true, error: null })
        const sessions = await listShellSessions()
        set({ sessions, isLoading: false })
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Failed to fetch sessions', isLoading: false })
      }
    },

    attach: async (agent: string) => {
      try {
        set({ isLoading: true, error: null })
        const session = await attachShell(agent)
        set((state) => ({
          sessions: [...state.sessions, session],
          activeSessionId: session.id,
          outputBuffers: {
            ...state.outputBuffers,
            [session.id]: [{
              id: genLineId(),
              stream: 'system',
              content: `Connected to ${session.agent_name} (${session.container_id.slice(0, 12)})`,
              timestamp: new Date().toISOString(),
            }],
          },
          isLoading: false,
        }))
        return session
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Failed to attach', isLoading: false })
        return null
      }
    },

    close: async (sessionId: string) => {
      try {
        await closeShellSession(sessionId)
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, status: 'closed' as const } : s
          ),
          activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
        }))
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Failed to close session' })
      }
    },

    setActiveSession: (sessionId) => {
      set({ activeSessionId: sessionId })
    },

    executeCommand: (sessionId: string, command: string) => {
      const state = get()
      if (state.isExecuting[sessionId]) return null

      // Add the command as an stdin line
      const inputLine: OutputLine = {
        id: genLineId(),
        stream: 'stdin',
        content: command,
        timestamp: new Date().toISOString(),
      }

      set((s) => ({
        outputBuffers: {
          ...s.outputBuffers,
          [sessionId]: [...(s.outputBuffers[sessionId] || []), inputLine],
        },
        isExecuting: { ...s.isExecuting, [sessionId]: true },
      }))

      const controller = execShellCommand(
        sessionId,
        command,
        // onChunk
        (chunk: ShellStreamChunk) => {
          const line: OutputLine = {
            id: genLineId(),
            stream: chunk.stream,
            content: chunk.data,
            timestamp: chunk.ts,
          }
          set((s) => {
            const buf = [...(s.outputBuffers[sessionId] || []), line]
            return {
              outputBuffers: {
                ...s.outputBuffers,
                [sessionId]: buf.length > MAX_OUTPUT_LINES ? buf.slice(-MAX_OUTPUT_LINES) : buf,
              },
            }
          })
        },
        // onDone
        (exitCode: number) => {
          const doneLine: OutputLine = {
            id: genLineId(),
            stream: 'system',
            content: `[exit ${exitCode}]`,
            timestamp: new Date().toISOString(),
          }
          set((s) => ({
            outputBuffers: {
              ...s.outputBuffers,
              [sessionId]: [...(s.outputBuffers[sessionId] || []), doneLine],
            },
            isExecuting: { ...s.isExecuting, [sessionId]: false },
          }))
        },
        // onError
        (error: string) => {
          const errLine: OutputLine = {
            id: genLineId(),
            stream: 'stderr',
            content: `[error: ${error}]`,
            timestamp: new Date().toISOString(),
          }
          set((s) => ({
            outputBuffers: {
              ...s.outputBuffers,
              [sessionId]: [...(s.outputBuffers[sessionId] || []), errLine],
            },
            isExecuting: { ...s.isExecuting, [sessionId]: false },
            error,
          }))
        },
      )

      return controller
    },

    clearOutput: (sessionId: string) => {
      set((s) => ({
        outputBuffers: { ...s.outputBuffers, [sessionId]: [] },
      }))
    },

    appendOutput: (sessionId: string, line: OutputLine) => {
      set((s) => {
        const buf = [...(s.outputBuffers[sessionId] || []), line]
        return {
          outputBuffers: {
            ...s.outputBuffers,
            [sessionId]: buf.length > MAX_OUTPUT_LINES ? buf.slice(-MAX_OUTPUT_LINES) : buf,
          },
        }
      })
    },
  })
)
