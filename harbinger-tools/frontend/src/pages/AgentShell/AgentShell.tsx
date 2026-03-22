import { useEffect, useRef, useState, useCallback } from 'react'
import { useAgentShellStore, type OutputLine } from '../../store/agentShellStore'

// Agent codenames for the selector dropdown
const AGENTS = [
  { codename: 'PATHFINDER', role: 'Recon Scout', dir: 'recon-scout' },
  { codename: 'BREACH', role: 'Web Hacker', dir: 'web-hacker' },
  { codename: 'PHANTOM', role: 'Cloud Infiltrator', dir: 'cloud-infiltrator' },
  { codename: 'SPECTER', role: 'OSINT Detective', dir: 'osint-detective' },
  { codename: 'CIPHER', role: 'Binary RE', dir: 'binary-reverser' },
  { codename: 'SCRIBE', role: 'Report Writer', dir: 'report-writer' },
  { codename: 'SAM', role: 'Coding Assistant', dir: 'coding-assistant' },
  { codename: 'BRIEF', role: 'Morning Reporter', dir: 'morning-brief' },
  { codename: 'SAGE', role: 'Learning Agent', dir: 'learning-agent' },
  { codename: 'LENS', role: 'Browser Agent', dir: 'browser-agent' },
  { codename: 'MAINTAINER', role: 'DevOps/Health', dir: 'maintainer' },
]

// ── Stream color map ────────────────────────────────────────────────────────

function streamColor(stream: string): string {
  switch (stream) {
    case 'stdin': return '#f0c040'   // gold — operator input
    case 'stdout': return '#e0e0e0'  // light gray — normal output
    case 'stderr': return '#ef4444'  // red — errors
    case 'system': return '#00d4ff'  // cyber blue — system messages
    default: return '#9ca3af'
  }
}

function streamPrefix(stream: string): string {
  switch (stream) {
    case 'stdin': return '$ '
    case 'stderr': return '! '
    case 'system': return '» '
    default: return ''
  }
}

// ── Output Line Component ───────────────────────────────────────────────────

function TerminalLine({ line }: { line: OutputLine }) {
  return (
    <div
      className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-all"
      style={{ color: streamColor(line.stream) }}
    >
      <span className="opacity-50 text-xs mr-2 select-none">
        {new Date(line.timestamp).toLocaleTimeString('en-US', { hour12: false })}
      </span>
      <span className="opacity-60 select-none">{streamPrefix(line.stream)}</span>
      {line.content}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function AgentShell() {
  const {
    sessions,
    activeSessionId,
    outputBuffers,
    isExecuting,
    error,
    fetchSessions,
    attach,
    close,
    setActiveSession,
    executeCommand,
    clearOutput,
  } = useAgentShellStore()

  const [commandInput, setCommandInput] = useState('')
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0].codename)
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load sessions on mount
  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // Auto-scroll to bottom on new output
  const activeOutput = activeSessionId ? outputBuffers[activeSessionId] || [] : []
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [activeOutput.length])

  // Focus input when session changes
  useEffect(() => {
    inputRef.current?.focus()
  }, [activeSessionId])

  const handleAttach = useCallback(async () => {
    await attach(selectedAgent)
  }, [attach, selectedAgent])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!commandInput.trim() || !activeSessionId) return

    setCommandHistory((h) => [...h, commandInput])
    setHistoryIndex(-1)

    abortRef.current = executeCommand(activeSessionId, commandInput.trim())
    setCommandInput('')
  }, [commandInput, activeSessionId, executeCommand])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length === 0) return
      const newIdx = historyIndex < 0 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(newIdx)
      setCommandInput(commandHistory[newIdx])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex < 0) return
      const newIdx = historyIndex + 1
      if (newIdx >= commandHistory.length) {
        setHistoryIndex(-1)
        setCommandInput('')
      } else {
        setHistoryIndex(newIdx)
        setCommandInput(commandHistory[newIdx])
      }
    } else if (e.key === 'c' && e.ctrlKey) {
      // Ctrl+C — abort running command
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
    }
  }, [commandHistory, historyIndex])

  const activeSessions = sessions.filter((s) => s.status === 'active')
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const executing = activeSessionId ? isExecuting[activeSessionId] || false : false

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a2e]">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-mono font-bold text-[#f0c040]">AGENT SHELL</h1>
          <span className="text-xs text-gray-500 font-mono">T5 // Interactive Container Access</span>
        </div>

        {/* Attach controls */}
        <div className="flex items-center gap-2">
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="bg-[#0d0d15] border border-[#1a1a2e] text-gray-300 text-sm font-mono
                       rounded px-2 py-1.5 focus:outline-none focus:border-[#f0c040]"
          >
            {AGENTS.map((a) => (
              <option key={a.codename} value={a.codename}>
                {a.codename} — {a.role}
              </option>
            ))}
          </select>
          <button
            onClick={handleAttach}
            className="px-3 py-1.5 bg-[#f0c040] text-black text-sm font-mono font-bold rounded
                       hover:bg-[#f0c040]/90 transition-colors"
          >
            ATTACH
          </button>
        </div>
      </div>

      {/* ── Session Tabs ───────────────────────────────────────────────── */}
      {activeSessions.length > 0 && (
        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-[#1a1a2e] bg-[#0d0d15] overflow-x-auto">
          {activeSessions.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-mono cursor-pointer
                         transition-colors ${
                           s.id === activeSessionId
                             ? 'bg-[#1a1a2e] text-[#f0c040] border border-[#f0c040]/30'
                             : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2e]/50'
                         }`}
              onClick={() => setActiveSession(s.id)}
            >
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              <span>{s.agent_name}</span>
              <span className="text-gray-600">{s.container_id.slice(0, 8)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  close(s.id)
                }}
                className="ml-1 text-gray-600 hover:text-[#ef4444] transition-colors"
                title="Close session"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Terminal Output ─────────────────────────────────────────────── */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto px-4 py-2 bg-[#0a0a0f] scrollbar-thin scrollbar-thumb-[#1a1a2e]"
        onClick={() => inputRef.current?.focus()}
      >
        {!activeSessionId ? (
          <div className="flex items-center justify-center h-full text-gray-600 font-mono text-sm">
            <div className="text-center">
              <div className="text-2xl mb-2">⌨</div>
              <div>Select an agent and click ATTACH to open a shell session</div>
              <div className="text-xs mt-1 text-gray-700">
                Requires the agent to have a running Docker container
              </div>
            </div>
          </div>
        ) : activeOutput.length === 0 ? (
          <div className="text-gray-600 font-mono text-sm">
            <span className="text-[#00d4ff]">»</span> Shell session ready. Type a command below.
          </div>
        ) : (
          activeOutput.map((line) => (
            <TerminalLine key={line.id} line={line} />
          ))
        )}
      </div>

      {/* ── Command Input Bar ──────────────────────────────────────────── */}
      {activeSessionId && (
        <div className="border-t border-[#1a1a2e] bg-[#0d0d15]">
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-1 text-xs font-mono text-gray-600">
            <div className="flex items-center gap-3">
              {activeSession && (
                <>
                  <span className="text-[#f0c040]">{activeSession.agent_name}</span>
                  <span>container:{activeSession.container_id.slice(0, 12)}</span>
                  <span>cmds:{activeSession.command_count}</span>
                </>
              )}
              {executing && (
                <span className="text-[#22c55e] animate-pulse">● executing</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => activeSessionId && clearOutput(activeSessionId)}
                className="hover:text-gray-300 transition-colors"
                title="Clear output"
              >
                [clear]
              </button>
              {executing && (
                <button
                  onClick={() => {
                    abortRef.current?.abort()
                    abortRef.current = null
                  }}
                  className="text-[#ef4444] hover:text-[#ef4444]/80 transition-colors"
                  title="Abort command (Ctrl+C)"
                >
                  [kill]
                </button>
              )}
            </div>
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center px-4 pb-3">
            <span className="text-[#f0c040] font-mono text-sm mr-2 select-none">
              {activeSession?.agent_name?.toLowerCase() || 'shell'}$
            </span>
            <input
              ref={inputRef}
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={executing}
              placeholder={executing ? 'waiting for command to finish...' : 'enter command...'}
              className="flex-1 bg-transparent border-none outline-none text-white font-mono text-sm
                         placeholder:text-gray-700 disabled:opacity-50"
              autoComplete="off"
              spellCheck={false}
            />
          </form>
        </div>
      )}

      {/* ── Error toast ────────────────────────────────────────────────── */}
      {error && (
        <div className="absolute bottom-16 right-4 bg-[#ef4444]/10 border border-[#ef4444]/30
                        text-[#ef4444] text-xs font-mono px-3 py-2 rounded max-w-sm">
          {error}
        </div>
      )}
    </div>
  )
}
