import { useEffect, useRef, useState } from 'react'
import type { WarRoomEvent } from '../api/missions'

function streamColor(stream: string): string {
  switch (stream) {
    case 'stdout': return '#e0e0e0'
    case 'stderr': return '#ef4444'
    case 'system': return '#00d4ff'
    default: return '#9ca3af'
  }
}

interface OutputLine {
  id: string
  agent: string
  stream: string
  content: string
  timestamp: number
}

interface TerminalStreamProps {
  events: WarRoomEvent[]
  agents: string[]
  className?: string
}

export default function TerminalStream({ events, agents, className = '' }: TerminalStreamProps) {
  const [activeAgent, setActiveAgent] = useState<string>('all')
  const outputRef = useRef<HTMLDivElement>(null)

  const lines: OutputLine[] = events
    .filter((e) => e.type === 'command_output' || e.type === 'action_log')
    .map((e) => ({
      id: e.id,
      agent: e.source,
      stream: (e.payload.stream as string) || 'stdout',
      content: (e.payload.data as string) || (e.payload.output as string) || JSON.stringify(e.payload),
      timestamp: e.timestamp,
    }))
    .filter((l) => activeAgent === 'all' || l.agent === activeAgent)

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [lines.length])

  return (
    <div className={`flex flex-col bg-[#0a0a0f] border border-[#1a1a2e] rounded ${className}`}>
      <div className="flex items-center gap-1 px-2 py-1 border-b border-[#1a1a2e] bg-[#0d0d15] overflow-x-auto">
        <button
          onClick={() => setActiveAgent('all')}
          className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
            activeAgent === 'all'
              ? 'bg-[#1a1a2e] text-[#f0c040]'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          ALL
        </button>
        {agents.map((agent) => (
          <button
            key={agent}
            onClick={() => setActiveAgent(agent)}
            className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
              activeAgent === agent
                ? 'bg-[#1a1a2e] text-[#f0c040]'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {agent}
          </button>
        ))}
      </div>
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs leading-relaxed scrollbar-thin scrollbar-thumb-[#1a1a2e]"
        style={{ maxHeight: '300px' }}
      >
        {lines.length === 0 ? (
          <div className="text-gray-600 text-center py-4">Waiting for agent output...</div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="whitespace-pre-wrap break-all">
              <span className="text-gray-600 mr-2 select-none">[{line.agent}]</span>
              <span style={{ color: streamColor(line.stream) }}>{line.content}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
