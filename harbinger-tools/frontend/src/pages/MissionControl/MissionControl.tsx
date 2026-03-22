import { useEffect, useState, useCallback } from 'react'
import { useMissionStore } from '../../store/missionStore'
import TaskGraph from './TaskGraph'
import TerminalStream from '../../components/TerminalStream'

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  idle:      { bg: '#1a1a2e', text: '#9ca3af' },
  executing: { bg: '#0d2818', text: '#22c55e' },
  waiting:   { bg: '#2d1f00', text: '#f0c040' },
  error:     { bg: '#2d0d0d', text: '#ef4444' },
}

export default function MissionControl() {
  const {
    missions,
    activeMission,
    tasks,
    agents,
    events,
    pendingApprovals,
    isLoading,
    error,
    fetchMissions,
    setActiveMission,
    executeMission,
    approveTask,
    injectCommand,
  } = useMissionStore()

  const [injectAgent, setInjectAgent] = useState('')
  const [injectCmd, setInjectCmd] = useState('')

  useEffect(() => {
    fetchMissions()
  }, [fetchMissions])

  const handleExecute = useCallback(() => {
    if (activeMission) executeMission(activeMission.id)
  }, [activeMission, executeMission])

  const handleInject = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (injectAgent && injectCmd) {
      injectCommand(injectAgent, injectCmd)
      setInjectCmd('')
    }
  }, [injectAgent, injectCmd, injectCommand])

  const agentCodenames = agents.map((a) => a.codename)

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a2e]">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-mono font-bold text-[#f0c040]">MISSION CONTROL</h1>
          <span className="text-xs text-gray-500 font-mono">T1 // Task DAG + Agent Orchestration</span>
        </div>

        {/* Mission selector */}
        <div className="flex items-center gap-2">
          <select
            onChange={(e) => {
              const id = Number(e.target.value)
              if (id) setActiveMission(id)
            }}
            value={activeMission?.id || ''}
            className="bg-[#0d0d15] border border-[#1a1a2e] text-gray-300 text-sm font-mono
                       rounded px-2 py-1.5 focus:outline-none focus:border-[#f0c040]"
          >
            <option value="">Select mission...</option>
            {missions.map((m) => (
              <option key={m.id} value={m.id}>
                #{m.id} — {m.title} [{m.status}]
              </option>
            ))}
          </select>
          {activeMission && activeMission.status === 'created' && (
            <button
              onClick={handleExecute}
              className="px-3 py-1.5 bg-[#22c55e] text-black text-sm font-mono font-bold rounded
                         hover:bg-[#22c55e]/90 transition-colors"
            >
              EXECUTE
            </button>
          )}
        </div>
      </div>

      {!activeMission ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 font-mono text-sm">
          <div className="text-center">
            <div className="text-2xl mb-2">⚡</div>
            <div>Select a mission to view its task graph and agent activity</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel: Agent status */}
          <div className="w-56 border-r border-[#1a1a2e] overflow-y-auto bg-[#0d0d15]">
            <div className="px-3 py-2 border-b border-[#1a1a2e]">
              <div className="text-xs font-mono text-gray-500 uppercase">Agents</div>
            </div>
            {agents.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-600 font-mono">No agents active</div>
            ) : (
              agents.map((agent) => {
                const badge = STATUS_BADGE[agent.status] || STATUS_BADGE.idle
                return (
                  <div
                    key={agent.codename}
                    className="px-3 py-2 border-b border-[#1a1a2e]/50 hover:bg-[#1a1a2e]/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono font-bold text-white">{agent.codename}</span>
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase"
                        style={{ backgroundColor: badge.bg, color: badge.text }}
                      >
                        {agent.status}
                      </span>
                    </div>
                    {agent.current_task && (
                      <div className="text-xs font-mono text-gray-500 mt-1 truncate">
                        {agent.current_task}
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {/* Pending approvals */}
            {pendingApprovals.length > 0 && (
              <div className="px-3 py-2 border-t border-[#1a1a2e]">
                <div className="text-xs font-mono text-[#f0c040] uppercase mb-1">
                  Pending Approvals ({pendingApprovals.length})
                </div>
                {pendingApprovals.map((taskId) => (
                  <div key={taskId} className="flex items-center justify-between py-1">
                    <span className="text-xs font-mono text-gray-400">Task #{taskId}</span>
                    <button
                      onClick={() => approveTask(taskId, true)}
                      className="text-[10px] font-mono px-2 py-0.5 bg-[#22c55e]/10 text-[#22c55e]
                                 border border-[#22c55e]/30 rounded hover:bg-[#22c55e]/20"
                    >
                      APPROVE
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Center: Task Graph + Terminal */}
          <div className="flex-1 flex flex-col">
            {/* Task DAG */}
            <div className="flex-1 min-h-0">
              <TaskGraph tasks={tasks} />
            </div>

            {/* Terminal stream */}
            <TerminalStream
              events={events}
              agents={agentCodenames}
              className="h-[250px] border-t border-[#1a1a2e]"
            />

            {/* Command inject bar */}
            <form
              onSubmit={handleInject}
              className="flex items-center gap-2 px-4 py-2 border-t border-[#1a1a2e] bg-[#0d0d15]"
            >
              <select
                value={injectAgent}
                onChange={(e) => setInjectAgent(e.target.value)}
                className="bg-[#0a0a0f] border border-[#1a1a2e] text-gray-300 text-xs font-mono
                           rounded px-2 py-1 focus:outline-none focus:border-[#f0c040] w-32"
              >
                <option value="">agent...</option>
                {agentCodenames.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <span className="text-[#f0c040] font-mono text-sm select-none">$</span>
              <input
                type="text"
                value={injectCmd}
                onChange={(e) => setInjectCmd(e.target.value)}
                placeholder="inject command..."
                className="flex-1 bg-transparent border-none outline-none text-white font-mono text-sm
                           placeholder:text-gray-700"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                disabled={!injectAgent || !injectCmd}
                className="px-3 py-1 text-xs font-mono bg-[#f0c040] text-black font-bold rounded
                           disabled:opacity-30 hover:bg-[#f0c040]/90 transition-colors"
              >
                INJECT
              </button>
            </form>
          </div>

          {/* Right panel: Event feed */}
          <div className="w-64 border-l border-[#1a1a2e] overflow-y-auto bg-[#0d0d15]">
            <div className="px-3 py-2 border-b border-[#1a1a2e]">
              <div className="text-xs font-mono text-gray-500 uppercase">
                Events ({events.length})
              </div>
            </div>
            {events.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-600 font-mono">No events yet</div>
            ) : (
              [...events].reverse().slice(0, 50).map((event) => (
                <div
                  key={event.id}
                  className="px-3 py-1.5 border-b border-[#1a1a2e]/30 text-xs font-mono"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[#f0c040]">{event.type}</span>
                    <span className="text-gray-600 text-[10px]">
                      {new Date(event.timestamp * 1000).toLocaleTimeString('en-US', { hour12: false })}
                    </span>
                  </div>
                  <div className="text-gray-500 truncate">
                    {event.source} → {event.target}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="absolute bottom-4 right-4 bg-[#ef4444]/10 border border-[#ef4444]/30
                        text-[#ef4444] text-xs font-mono px-3 py-2 rounded max-w-sm">
          {error}
        </div>
      )}
    </div>
  )
}
