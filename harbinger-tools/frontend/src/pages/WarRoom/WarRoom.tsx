import { useEffect, useState, useCallback } from 'react'
import { useMissionStore } from '../../store/missionStore'
import TerminalStream from '../../components/TerminalStream'
import type { WarRoomEvent } from '../../api/missions'

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  created:   { bg: '#1a1a2e', text: '#9ca3af' },
  queued:    { bg: '#1a1a2e', text: '#f0c040' },
  running:   { bg: '#0d2818', text: '#22c55e' },
  finished:  { bg: '#0d1f0d', text: '#16a34a' },
  failed:    { bg: '#2d0d0d', text: '#ef4444' },
  waiting:   { bg: '#2d1f00', text: '#f0c040' },
  idle:      { bg: '#1a1a2e', text: '#555' },
  executing: { bg: '#0d2818', text: '#22c55e' },
}

export default function WarRoom() {
  const {
    missions, activeMission, tasks, agents, events, isLoading, error,
    fetchMissions, setActiveMission, injectCommand, fetchWarRoomState,
  } = useMissionStore()

  const [missionId, setMissionId] = useState<number | null>(null)
  const [injectAgent, setInjectAgent] = useState('')
  const [injectCmd, setInjectCmd] = useState('')
  const [sseCleanup, setSseCleanup] = useState<(() => void) | null>(null)

  useEffect(() => { fetchMissions() }, [fetchMissions])

  const handleSelectMission = useCallback((id: number) => {
    setMissionId(id)
    setActiveMission(id)

    // SSE subscription
    if (sseCleanup) sseCleanup()
    const token = localStorage.getItem('harbinger-token') || ''
    const es = new EventSource(`/api/v2/warroom/${id}/stream?token=${token}`)
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as WarRoomEvent
        useMissionStore.getState().addEvent(event)
        if (['task_update', 'mission_update'].includes(event.type)) {
          fetchWarRoomState(id)
        }
      } catch { /* skip */ }
    }
    setSseCleanup(() => () => es.close())
  }, [setActiveMission, fetchWarRoomState, sseCleanup])

  useEffect(() => { return () => { if (sseCleanup) sseCleanup() } }, [sseCleanup])

  const handleInject = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (injectAgent && injectCmd) {
      injectCommand(injectAgent, injectCmd)
      setInjectCmd('')
    }
  }, [injectAgent, injectCmd, injectCommand])

  const agentNames = agents.map(a => a.codename)

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a2e]">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-mono font-bold text-[#f0c040]">WAR ROOM</h1>
          <span className="text-xs text-gray-500 font-mono">T4 // Real-time Mission Coordination</span>
        </div>
        <select
          onChange={(e) => { const id = Number(e.target.value); if (id) handleSelectMission(id) }}
          value={missionId || ''}
          className="bg-[#0d0d15] border border-[#1a1a2e] text-gray-300 text-sm font-mono rounded px-2 py-1.5 focus:outline-none focus:border-[#f0c040]"
        >
          <option value="">Select mission...</option>
          {missions.map(m => (
            <option key={m.id} value={m.id}>#{m.id} — {m.title} [{m.status}]</option>
          ))}
        </select>
      </div>

      {!missionId ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 font-mono text-sm">
          <div className="text-center">
            <div className="text-2xl mb-2">📡</div>
            <div>Select a mission to enter the War Room</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Tasks + Agents */}
          <div className="w-72 border-r border-[#1a1a2e] overflow-y-auto bg-[#0d0d15]">
            {/* Mission info */}
            {activeMission && (
              <div className="px-3 py-2 border-b border-[#1a1a2e]">
                <div className="text-xs font-mono text-gray-500">Mission #{activeMission.id}</div>
                <div className="text-sm font-mono font-bold text-white mt-1">{activeMission.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: (STATUS_BADGE[activeMission.status] || STATUS_BADGE.created).bg, color: (STATUS_BADGE[activeMission.status] || STATUS_BADGE.created).text }}>
                    {activeMission.status.toUpperCase()}
                  </span>
                  {activeMission.target && <span className="text-xs text-gray-500 font-mono">{activeMission.target}</span>}
                </div>
              </div>
            )}

            {/* Tasks */}
            <div className="px-3 py-2 border-b border-[#1a1a2e]">
              <div className="text-xs font-mono text-gray-500 uppercase mb-1">Tasks ({tasks.length})</div>
            </div>
            {tasks.map(task => {
              const badge = STATUS_BADGE[task.status] || STATUS_BADGE.created
              return (
                <div key={task.id} className="px-3 py-2 border-b border-[#1a1a2e]/50 hover:bg-[#1a1a2e]/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white truncate flex-1">{task.title}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded ml-2"
                      style={{ backgroundColor: badge.bg, color: badge.text }}>
                      {task.status}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-gray-600 mt-0.5">
                    {task.agent_codename || '—'} {task.depends_on?.length ? `← deps: ${task.depends_on.join(',')}` : ''}
                  </div>
                </div>
              )
            })}

            {/* Agents */}
            <div className="px-3 py-2 border-b border-[#1a1a2e] mt-2">
              <div className="text-xs font-mono text-gray-500 uppercase mb-1">Agents ({agents.length})</div>
            </div>
            {agents.map(agent => {
              const badge = STATUS_BADGE[agent.status] || STATUS_BADGE.idle
              return (
                <div key={agent.codename} className="px-3 py-1.5 border-b border-[#1a1a2e]/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono font-bold" style={{ color: badge.text }}>{agent.codename}</span>
                    <span className="text-[10px] font-mono">{agent.status}</span>
                  </div>
                  {agent.current_task && <div className="text-[10px] text-gray-600 font-mono truncate">{agent.current_task}</div>}
                </div>
              )
            })}
          </div>

          {/* Center: Event stream + Terminal */}
          <div className="flex-1 flex flex-col">
            {/* Event log */}
            <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-thin scrollbar-thumb-[#1a1a2e]">
              {events.length === 0 ? (
                <div className="text-gray-600 font-mono text-sm text-center py-8">Waiting for events...</div>
              ) : (
                [...events].reverse().slice(0, 100).map(event => {
                  const color: Record<string, string> = {
                    agent_status: '#00d4ff', command_output: '#e0e0e0', task_update: '#f0c040',
                    operator_action: '#a855f7', system_alert: '#ef4444', action_log: '#22c55e',
                  }
                  return (
                    <div key={event.id} className="text-xs font-mono py-0.5">
                      <span className="text-gray-600 mr-2">
                        {new Date(event.timestamp * 1000).toLocaleTimeString('en-US', { hour12: false })}
                      </span>
                      <span style={{ color: color[event.type] || '#9ca3af' }} className="mr-2">{event.type}</span>
                      <span className="text-gray-500">{event.source} → {event.target}</span>
                      {event.payload?.data != null && <span className="text-gray-400 ml-2">{String(event.payload.data).slice(0, 80)}</span>}
                    </div>
                  )
                })
              )}
            </div>

            {/* Terminal output */}
            <TerminalStream events={events} agents={agentNames} className="h-[200px] border-t border-[#1a1a2e]" />

            {/* Inject bar */}
            <form onSubmit={handleInject} className="flex items-center gap-2 px-4 py-2 border-t border-[#1a1a2e] bg-[#0d0d15]">
              <select value={injectAgent} onChange={e => setInjectAgent(e.target.value)}
                className="bg-[#0a0a0f] border border-[#1a1a2e] text-gray-300 text-xs font-mono rounded px-2 py-1 w-32">
                <option value="">agent...</option>
                {agentNames.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <span className="text-[#f0c040] font-mono text-sm">$</span>
              <input type="text" value={injectCmd} onChange={e => setInjectCmd(e.target.value)}
                placeholder="inject command..." autoComplete="off" spellCheck={false}
                className="flex-1 bg-transparent border-none outline-none text-white font-mono text-sm placeholder:text-gray-700" />
              <button type="submit" disabled={!injectAgent || !injectCmd}
                className="px-3 py-1 text-xs font-mono bg-[#f0c040] text-black font-bold rounded disabled:opacity-30">
                INJECT
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
