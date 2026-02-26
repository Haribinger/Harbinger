import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  MessageSquare,
  Terminal,
  Globe,
  FileText,
  Settings as SettingsIcon,
  Activity,
  X,
  Play,
  Square,
  RefreshCw,
  Cpu,
  MemoryStick,
  Send,
  Server,
  ChevronDown,
  ChevronRight,
  Filter,
  Maximize2,
  Plus,
  Copy,
} from 'lucide-react'
import { useAgentStore } from '../../store/agentStore'
import { useDockerStore } from '../../store/dockerStore'
import { useCommandCenterStore, type TabType, type WorkspaceTab } from '../../store/commandCenterStore'
import { browserApi } from '../../api/browser'
import type { Agent, Message } from '../../types'

// ---- Status helpers ----

function statusDot(status: Agent['status']) {
  const colors: Record<string, string> = {
    running: 'bg-green-400', spawned: 'bg-green-400', heartbeat: 'bg-green-400', online: 'bg-green-400',
    working: 'bg-yellow-400', busy: 'bg-yellow-400',
    idle: 'bg-gray-400', offline: 'bg-gray-400',
    stopped: 'bg-red-400', error: 'bg-red-400',
  }
  return <div className={`w-2 h-2 rounded-full ${colors[status] || 'bg-gray-500'} shrink-0`} />
}

function statusLabel(status: Agent['status']) {
  const map: Record<string, string> = {
    running: 'Running', spawned: 'Spawned', heartbeat: 'Active', online: 'Online',
    working: 'Working', busy: 'Busy',
    idle: 'Idle', offline: 'Offline',
    stopped: 'Stopped', error: 'Error', initializing: 'Init',
  }
  return map[status] || status
}

const tabIcons: Record<TabType, typeof MessageSquare> = {
  chat: MessageSquare,
  terminal: Terminal,
  browser: Globe,
  logs: FileText,
  files: Copy,
  settings: SettingsIcon,
  graph: Activity,
}

// ---- Main Component ----

function CommandCenter() {
  const agents = useAgentStore((s) => s.agents)
  const activeAgent = useAgentStore((s) => s.activeAgent)
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)
  const spawnAgentById = useAgentStore((s) => s.spawnAgentById)
  const stopAgent = useAgentStore((s) => s.stopAgent)
  const fetchAgents = useAgentStore((s) => s.fetchAgents)

  const containers = useDockerStore((s) => s.containers)
  const fetchContainers = useDockerStore((s) => s.fetchContainers)

  const {
    tabs, activeTabId, selectedAgentId,
    agentFilter, statusFilter, activityEvents,
    showVMPanel, showActivityPanel,
    addTab, removeTab, setActiveTab,
    setSelectedAgent, setAgentFilter, setStatusFilter,
    addActivity, toggleVMPanel, toggleActivityPanel,
    openAgentChat, openAgentTerminal, openAgentLogs, openAgentBrowser,
  } = useCommandCenterStore()

  // Fetch data on mount
  useEffect(() => {
    fetchAgents().catch(() => {})
    fetchContainers().catch(() => {})
    const interval = setInterval(() => {
      fetchAgents().catch(() => {})
      fetchContainers().catch(() => {})
    }, 10_000)
    return () => clearInterval(interval)
  }, [fetchAgents, fetchContainers])

  // Filter agents
  const filteredAgents = agents.filter((a) => {
    if (agentFilter && !a.name.toLowerCase().includes(agentFilter.toLowerCase()) &&
        !a.codename.toLowerCase().includes(agentFilter.toLowerCase())) return false
    if (statusFilter !== 'all') {
      const running = ['running', 'spawned', 'heartbeat', 'online', 'working', 'busy']
      const stopped = ['stopped', 'error', 'offline', 'idle']
      if (statusFilter === 'running' && !running.includes(a.status)) return false
      if (statusFilter === 'stopped' && !stopped.includes(a.status)) return false
    }
    return true
  })

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || null
  const activeTab = tabs.find((t) => t.id === activeTabId) || null

  // Stat counts
  const runningCount = agents.filter((a) =>
    ['running', 'spawned', 'heartbeat', 'online', 'working', 'busy'].includes(a.status)
  ).length
  const containerCount = containers.filter((c) => c.status === 'running').length

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col overflow-hidden"
    >
      {/* Top bar */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold font-mono tracking-wider text-[#f0c040]">COMMAND CENTER</h1>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="px-2 py-0.5 bg-surface-light rounded border border-border">
              Agents: <span className="text-white">{runningCount}/{agents.length}</span>
            </span>
            <span className="px-2 py-0.5 bg-surface-light rounded border border-border">
              Containers: <span className="text-white">{containerCount}</span>
            </span>
            <span className="px-2 py-0.5 bg-surface-light rounded border border-border">
              Tabs: <span className="text-white">{tabs.length}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleActivityPanel}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              showActivityPanel
                ? 'bg-[#f0c040]/10 border-[#f0c040]/30 text-[#f0c040]'
                : 'border-border text-text-secondary hover:text-white'
            }`}
          >
            <Activity className="w-3 h-3 inline mr-1" />
            Activity
          </button>
          <button
            onClick={toggleVMPanel}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              showVMPanel
                ? 'bg-[#f0c040]/10 border-[#f0c040]/30 text-[#f0c040]'
                : 'border-border text-text-secondary hover:text-white'
            }`}
          >
            <Server className="w-3 h-3 inline mr-1" />
            VMs
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar: Agent list */}
        <AgentListPanel
          agents={filteredAgents}
          selectedAgentId={selectedAgentId}
          agentFilter={agentFilter}
          statusFilter={statusFilter}
          onSelect={(a) => {
            setSelectedAgent(a.id)
            setActiveAgent(a)
          }}
          onFilterChange={setAgentFilter}
          onStatusFilterChange={setStatusFilter}
          onChat={(a) => openAgentChat(a.id, a.codename || a.name)}
          onTerminal={(a) => openAgentTerminal(a.id, a.codename || a.name)}
          onLogs={(a) => openAgentLogs(a.id, a.codename || a.name)}
          onBrowser={(a) => openAgentBrowser(a.id, a.codename || a.name)}
          onSpawn={(a) => {
            spawnAgentById(a.id).catch(() => {})
            addActivity({ agentId: a.id, agentName: a.codename || a.name, agentColor: a.color, message: 'Agent spawned', type: 'success' })
          }}
          onStop={(a) => {
            stopAgent(a.id).catch(() => {})
            addActivity({ agentId: a.id, agentName: a.codename || a.name, agentColor: a.color, message: 'Agent stopped', type: 'warning' })
          }}
        />

        {/* Main workspace */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          {tabs.length > 0 && (
            <div className="h-9 border-b border-border flex items-center bg-[#0a0a0f] overflow-x-auto shrink-0">
              {tabs.map((tab) => {
                const Icon = tabIcons[tab.type]
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 h-full text-xs border-r border-border whitespace-nowrap transition-colors ${
                      activeTabId === tab.id
                        ? 'bg-surface text-white border-b-2 border-b-[#f0c040]'
                        : 'text-text-secondary hover:text-white hover:bg-surface-light'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{tab.label}</span>
                    {tab.closable && (
                      <X
                        className="w-3 h-3 ml-1 opacity-40 hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); removeTab(tab.id) }}
                      />
                    )}
                  </button>
                )
              })}
              <button
                onClick={() => addTab({ type: 'chat', label: 'New Chat', closable: true })}
                className="px-2 h-full text-text-secondary hover:text-white transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab ? (
              <TabContent tab={activeTab} agent={selectedAgent} agents={agents} />
            ) : (
              <EmptyWorkspace onOpenChat={() => {
                if (agents.length > 0) openAgentChat(agents[0].id, agents[0].codename || agents[0].name)
              }} />
            )}
          </div>
        </div>

        {/* Right panels */}
        {(showVMPanel || showActivityPanel) && (
          <div className="w-72 border-l border-border flex flex-col overflow-hidden bg-surface shrink-0">
            {showVMPanel && (
              <VMPanel containers={containers} onRefresh={() => fetchContainers().catch(() => {})} />
            )}
            {showActivityPanel && (
              <ActivityPanel events={activityEvents} />
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ---- Agent List Panel ----

function AgentListPanel({
  agents, selectedAgentId, agentFilter, statusFilter,
  onSelect, onFilterChange, onStatusFilterChange,
  onChat, onTerminal, onLogs, onBrowser, onSpawn, onStop,
}: {
  agents: Agent[]
  selectedAgentId: string | null
  agentFilter: string
  statusFilter: string
  onSelect: (a: Agent) => void
  onFilterChange: (v: string) => void
  onStatusFilterChange: (v: string) => void
  onChat: (a: Agent) => void
  onTerminal: (a: Agent) => void
  onLogs: (a: Agent) => void
  onBrowser: (a: Agent) => void
  onSpawn: (a: Agent) => void
  onStop: (a: Agent) => void
}) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  return (
    <div className="w-64 border-r border-border flex flex-col bg-surface shrink-0">
      <div className="p-3 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary" />
          <input
            type="text"
            value={agentFilter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Search agents..."
            className="w-full bg-surface-light border border-border rounded pl-8 pr-3 py-1.5 text-xs placeholder:text-text-secondary focus:border-[#f0c040] focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          {['all', 'running', 'stopped'].map((f) => (
            <button
              key={f}
              onClick={() => onStatusFilterChange(f)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                statusFilter === f
                  ? 'bg-[#f0c040]/20 text-[#f0c040]'
                  : 'text-text-secondary hover:text-white'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {agents.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            <p className="text-xs">No agents found</p>
          </div>
        ) : (
          agents.map((a) => (
            <div key={a.id}>
              <button
                onClick={() => { onSelect(a); setExpandedAgent(expandedAgent === a.id ? null : a.id) }}
                className={`w-full text-left p-2.5 rounded-lg transition-all ${
                  selectedAgentId === a.id
                    ? 'bg-[#f0c040]/10 border border-[#f0c040]/30'
                    : 'hover:bg-surface-light border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: a.color + '20', color: a.color, border: `1px solid ${a.color}40` }}
                  >
                    {(a.codename || a.name).charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {statusDot(a.status)}
                      <span className="text-xs font-medium truncate">{a.codename || a.name}</span>
                    </div>
                    <p className="text-[10px] text-text-secondary truncate">{a.currentTask || statusLabel(a.status)}</p>
                  </div>
                  {expandedAgent === a.id ? (
                    <ChevronDown className="w-3 h-3 text-text-secondary shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-text-secondary shrink-0" />
                  )}
                </div>

                {/* Resource bars */}
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Cpu className="w-2.5 h-2.5" />
                    {a.toolsCount || 0}t
                  </span>
                  <span className="flex items-center gap-1">
                    <MemoryStick className="w-2.5 h-2.5" />
                    {a.findingsCount || 0}f
                  </span>
                </div>
              </button>

              {/* Expanded quick actions */}
              {expandedAgent === a.id && (
                <div className="px-2 pb-1 flex flex-wrap gap-1 mt-1">
                  <button
                    onClick={() => onChat(a)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] bg-surface-light border border-border rounded hover:border-[#f0c040]/30 transition-colors"
                  >
                    <MessageSquare className="w-2.5 h-2.5" /> Chat
                  </button>
                  <button
                    onClick={() => onTerminal(a)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] bg-surface-light border border-border rounded hover:border-[#f0c040]/30 transition-colors"
                  >
                    <Terminal className="w-2.5 h-2.5" /> Term
                  </button>
                  <button
                    onClick={() => onLogs(a)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] bg-surface-light border border-border rounded hover:border-[#f0c040]/30 transition-colors"
                  >
                    <FileText className="w-2.5 h-2.5" /> Logs
                  </button>
                  <button
                    onClick={() => onBrowser(a)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] bg-surface-light border border-border rounded hover:border-[#f0c040]/30 transition-colors"
                  >
                    <Globe className="w-2.5 h-2.5" /> Browser
                  </button>
                  {['stopped', 'idle', 'error', 'offline'].includes(a.status) ? (
                    <button
                      onClick={() => onSpawn(a)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] bg-green-500/10 border border-green-500/20 text-green-400 rounded hover:bg-green-500/20 transition-colors"
                    >
                      <Play className="w-2.5 h-2.5" /> Spawn
                    </button>
                  ) : (
                    <button
                      onClick={() => onStop(a)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 rounded hover:bg-red-500/20 transition-colors"
                    >
                      <Square className="w-2.5 h-2.5" /> Stop
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ---- Tab Content Router ----

function TabContent({ tab, agent, agents }: { tab: WorkspaceTab; agent: Agent | null; agents: Agent[] }) {
  switch (tab.type) {
    case 'chat': return <ChatPanel tab={tab} agent={agent} agents={agents} />
    case 'terminal': return <TerminalPanel tab={tab} agent={agent} />
    case 'browser': return <BrowserPanel tab={tab} agent={agent} />
    case 'logs': return <LogsPanel tab={tab} agent={agent} />
    case 'files': return <FilesPanel tab={tab} agent={agent} />
    case 'settings': return <AgentSettingsPanel tab={tab} agent={agent} />
    default: return <EmptyWorkspace onOpenChat={() => {}} />
  }
}

// ---- Chat Panel ----

function ChatPanel({ tab, agent, agents }: { tab: WorkspaceTab; agent: Agent | null; agents: Agent[] }) {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ id: string; role: string; content: string; agent?: string; time: string }>>([])
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const addActivity = useCommandCenterStore((s) => s.addActivity)

  const targetAgent = tab.agentId ? agents.find((a) => a.id === tab.agentId) : agent

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!message.trim() || !targetAgent) return
    const userMsg = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      time: new Date().toLocaleTimeString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setMessage('')
    setSending(true)

    try {
      const res = await fetch('/api/agents/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('harbinger-token') || ''}`,
        },
        body: JSON.stringify({
          agentIds: [targetAgent.id],
          message: message,
          type: 'chat',
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const reply = data.response || data.message || 'Command received.'
        setMessages((prev) => [...prev, {
          id: `msg-${Date.now()}-reply`,
          role: 'assistant',
          content: reply,
          agent: targetAgent.codename || targetAgent.name,
          time: new Date().toLocaleTimeString(),
        }])
        addActivity({
          agentId: targetAgent.id,
          agentName: targetAgent.codename || targetAgent.name,
          agentColor: targetAgent.color,
          message: `Responded to chat message`,
          type: 'info',
        })
      } else {
        setMessages((prev) => [...prev, {
          id: `msg-${Date.now()}-err`,
          role: 'system',
          content: `Agent unreachable (HTTP ${res.status}). Message queued.`,
          time: new Date().toLocaleTimeString(),
        }])
      }
    } catch {
      setMessages((prev) => [...prev, {
        id: `msg-${Date.now()}-err`,
        role: 'system',
        content: 'Network error. Backend may be offline.',
        time: new Date().toLocaleTimeString(),
      }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Chat header */}
      <div className="h-10 border-b border-border flex items-center justify-between px-4 bg-surface shrink-0">
        <div className="flex items-center gap-2 text-xs">
          {targetAgent && (
            <>
              <div
                className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
                style={{ backgroundColor: targetAgent.color + '20', color: targetAgent.color }}
              >
                {(targetAgent.codename || targetAgent.name).charAt(0)}
              </div>
              <span className="font-medium">{targetAgent.codename || targetAgent.name}</span>
              {statusDot(targetAgent.status)}
              <span className="text-text-secondary">{statusLabel(targetAgent.status)}</span>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12 text-text-secondary">
            <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Send a command to {targetAgent?.codename || 'the agent'}</p>
            <p className="text-xs mt-1">Use @agent_name to mention specific agents</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role !== 'user' && (
              <div className="w-6 h-6 rounded bg-[#f0c040]/20 flex items-center justify-center text-[10px] font-bold text-[#f0c040] shrink-0">
                {msg.agent?.charAt(0) || 'S'}
              </div>
            )}
            <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-[#f0c040]/10 border border-[#f0c040]/20'
                : msg.role === 'system'
                  ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                  : 'bg-surface-light border border-border'
            }`}>
              {msg.agent && <div className="text-[10px] text-[#f0c040] font-medium mb-0.5">[{msg.agent}]</div>}
              <pre className="whitespace-pre-wrap font-mono text-xs">{msg.content}</pre>
              <div className="text-[10px] text-text-secondary mt-1">{msg.time}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 bg-surface shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={`Message ${targetAgent?.codename || 'agent'}...`}
            disabled={sending}
            className="flex-1 bg-surface-light border border-border rounded-lg px-3 py-2 text-sm placeholder:text-text-secondary focus:border-[#f0c040] focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="px-3 py-2 bg-[#f0c040]/10 border border-[#f0c040]/30 text-[#f0c040] rounded-lg hover:bg-[#f0c040]/20 disabled:opacity-30 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Terminal Panel ----

function TerminalPanel({ tab, agent }: { tab: WorkspaceTab; agent: Agent | null }) {
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState<string[]>([])
  const [executing, setExecuting] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const targetAgent = agent || null
  const prompt = `${targetAgent?.codename?.toLowerCase() || 'harbinger'}@agent:~$`

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [output])

  const handleExec = async () => {
    if (!command.trim()) return
    const cmd = command.trim()
    setOutput((prev) => [...prev, `${prompt} ${cmd}`])
    setCommand('')
    setExecuting(true)

    try {
      const containerId = targetAgent?.containerId
      if (!containerId) {
        setOutput((prev) => [...prev, `Error: No container attached to ${targetAgent?.codename || 'agent'}. Spawn the agent first.`])
        return
      }

      const res = await fetch(`/api/docker/containers/${containerId}/logs?tail=50`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('harbinger-token') || ''}` },
      })
      if (res.ok) {
        const text = await res.text()
        const logs = text ? text.split(/\r?\n/).filter(Boolean) : []
        setOutput((prev) => [...prev, ...logs])
      } else {
        setOutput((prev) => [...prev, `Error: Container exec failed (HTTP ${res.status})`])
      }
    } catch {
      setOutput((prev) => [...prev, 'Error: Backend unreachable'])
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs">
        <div className="text-green-400 mb-2">
          {`=== ${targetAgent?.codename || 'HARBINGER'} Terminal ===`}
        </div>
        <div className="text-text-secondary mb-4">
          {targetAgent?.containerId
            ? `Connected to container ${targetAgent.containerId.slice(0, 12)}`
            : 'No container attached. Spawn the agent to connect.'}
        </div>
        {output.map((line, i) => (
          <div key={i} className={`${line.startsWith('Error') ? 'text-red-400' : line.startsWith(prompt) ? 'text-green-400' : 'text-gray-300'}`}>
            {line}
          </div>
        ))}
        {executing && <div className="text-yellow-400 animate-pulse">Executing...</div>}
      </div>
      <div className="border-t border-border p-2 bg-[#0d0d15] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-green-400 text-xs font-mono">{prompt}</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleExec() }}
            disabled={executing}
            className="flex-1 bg-transparent text-xs font-mono text-white focus:outline-none disabled:opacity-50"
            placeholder="Enter command..."
          />
        </div>
      </div>
    </div>
  )
}

// ---- Browser Panel ----

function BrowserPanel({ tab, agent }: { tab: WorkspaceTab; agent: Agent | null }) {
  const [url, setUrl] = useState('')
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const sessionIdByAgentRef = useRef<Record<string, string>>({})
  const [sessionIdByAgent, setSessionIdByAgent] = useState<Record<string, string>>({})
  const [sessionError, setSessionError] = useState<string | null>(null)

  const agentId = agent?.id ?? ''

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (!agentId) return null
    const existing = sessionIdByAgentRef.current[agentId]
    if (existing) return existing
    setSessionError(null)
    try {
      const session = await browserApi.createSession({ url: 'about:blank', headless: true })
      sessionIdByAgentRef.current[agentId] = session.id
      setSessionIdByAgent((prev) => ({ ...prev, [agentId]: session.id }))
      return session.id
    } catch {
      setSessionError('Failed to create browser session')
      return null
    }
  }, [agentId])

  const handleNavigate = async () => {
    if (!url.trim() || !agent) return
    setLoading(true)
    setSessionError(null)
    try {
      const sessionId = await ensureSession()
      if (!sessionId) {
        setSessionError('No browser session available')
        return
      }
      await browserApi.navigate(sessionId, url.trim())
      const ss = await browserApi.takeScreenshot(sessionId)
      if (ss?.data) setScreenshot(ss.data)
    } catch { setSessionError('Navigation failed') } finally { setLoading(false) }
  }

  return (
    <div className="h-full flex flex-col">
      {/* URL bar */}
      <div className="h-10 border-b border-border flex items-center gap-2 px-3 bg-surface shrink-0">
        <Globe className="w-4 h-4 text-text-secondary shrink-0" />
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleNavigate() }}
          placeholder="https://target.com"
          className="flex-1 bg-surface-light border border-border rounded px-3 py-1 text-xs focus:border-[#f0c040] focus:outline-none"
        />
        <button
          onClick={handleNavigate}
          disabled={loading}
          className="px-3 py-1 text-xs bg-[#f0c040]/10 border border-[#f0c040]/30 text-[#f0c040] rounded hover:bg-[#f0c040]/20 disabled:opacity-30 transition-colors"
        >
          {loading ? 'Loading...' : 'Go'}
        </button>
      </div>

      {/* Viewport */}
      <div className="flex-1 bg-[#0a0a0f] flex flex-col items-center justify-center overflow-auto relative">
        {sessionError && (
          <div className="absolute top-2 left-4 right-4 py-2 px-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded z-10">
            {sessionError}
          </div>
        )}
        {screenshot ? (
          <img src={`data:image/png;base64,${screenshot}`} alt="Browser view" className="max-w-full max-h-full object-contain" />
        ) : (
          <div className="text-center text-text-secondary">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Browser Panel</p>
            <p className="text-xs mt-1">
              {agent
                ? 'Enter a URL and navigate to see the live view'
                : 'Select an agent to enable browser automation'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Logs Panel ----

function LogsPanel({ tab, agent }: { tab: WorkspaceTab; agent: Agent | null }) {
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchLogs = async () => {
    if (!tab.agentId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/agents/${tab.agentId}/logs?tail=200`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('harbinger-token') || ''}` },
      })
      if (res.ok) {
        const data = await res.json()
        const entries = Array.isArray(data) ? data : (data.logs || [])
        setLogs(entries.map((l: any) => typeof l === 'string' ? l : l.message || JSON.stringify(l)))
      }
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  useEffect(() => { fetchLogs() }, [tab.agentId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [logs])

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      <div className="h-9 border-b border-border flex items-center justify-between px-3 bg-surface shrink-0">
        <span className="text-xs font-medium">Agent Logs</span>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="p-1 text-text-secondary hover:text-white transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5">
        {logs.length === 0 ? (
          <div className="text-text-secondary text-center py-8">No logs available</div>
        ) : (
          logs.map((line, i) => (
            <div key={i} className={`${
              line.includes('ERROR') || line.includes('error') ? 'text-red-400'
              : line.includes('WARN') || line.includes('warn') ? 'text-yellow-400'
              : line.includes('SUCCESS') || line.includes('found') ? 'text-green-400'
              : 'text-gray-400'
            }`}>
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ---- Files Panel ----

function FilesPanel({ tab, agent }: { tab: WorkspaceTab; agent: Agent | null }) {
  return (
    <div className="h-full flex items-center justify-center text-text-secondary">
      <div className="text-center">
        <Copy className="w-8 h-8 mx-auto mb-3 opacity-20" />
        <p className="text-sm">Agent File Browser</p>
        <p className="text-xs mt-1">
          {agent?.containerId
            ? `Browse files in container ${agent.containerId.slice(0, 12)}`
            : 'Spawn the agent to access its filesystem'}
        </p>
      </div>
    </div>
  )
}

// ---- Agent Settings Panel ----

function AgentSettingsPanel({ tab, agent }: { tab: WorkspaceTab; agent: Agent | null }) {
  if (!agent) {
    return (
      <div className="h-full flex items-center justify-center text-text-secondary">
        <p className="text-sm">Select an agent to view settings</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <h2 className="text-lg font-bold">{agent.codename || agent.name}</h2>
      <div className="bg-surface rounded-lg border border-border p-4 space-y-3">
        {[
          { label: 'ID', value: agent.id },
          { label: 'Status', value: agent.status },
          { label: 'Model', value: agent.config?.model || 'default' },
          { label: 'Temperature', value: agent.config?.temperature ?? 0.7 },
          { label: 'Max Tokens', value: agent.config?.maxTokens ?? 4096 },
          { label: 'Docker Image', value: agent.config?.docker_image || 'N/A' },
          { label: 'Tools', value: agent.toolsCount },
          { label: 'Findings', value: agent.findingsCount },
          { label: 'Capabilities', value: agent.capabilities?.join(', ') || 'None' },
        ].map((item) => (
          <div key={item.label} className="flex justify-between items-center text-sm">
            <span className="text-text-secondary">{item.label}</span>
            <span className="font-mono text-xs">{String(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- VM / Container Panel ----

function VMPanel({ containers, onRefresh }: {
  containers: Array<{ id: string; name: string; image: string; status: string }>
  onRefresh: () => void
}) {
  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium">Containers</span>
        <button onClick={onRefresh} className="p-1 text-text-secondary hover:text-white transition-colors">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto p-2 space-y-1">
        {containers.length === 0 ? (
          <div className="text-center py-4 text-text-secondary text-xs">No containers running</div>
        ) : (
          containers.map((c) => (
            <div key={c.id} className="flex items-center gap-2 p-2 bg-surface-light rounded border border-border text-xs">
              <div className={`w-2 h-2 rounded-full shrink-0 ${c.status === 'running' ? 'bg-green-400' : 'bg-gray-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-text-secondary truncate">{c.image}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ---- Activity Panel ----

function ActivityPanel({ events }: { events: Array<{ id: string; agentName: string; agentColor: string; message: string; type: string; timestamp: string }> }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-medium">Activity</span>
        <span className="text-[10px] text-text-secondary">{events.length} events</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {events.length === 0 ? (
          <div className="text-center py-4 text-text-secondary text-xs">No activity yet</div>
        ) : (
          events.map((evt) => (
            <div key={evt.id} className="flex items-start gap-2 p-2 bg-surface-light rounded border border-border">
              <div
                className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5"
                style={{ backgroundColor: evt.agentColor + '20', color: evt.agentColor }}
              >
                {evt.agentName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium">{evt.agentName}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    evt.type === 'success' ? 'bg-green-400'
                    : evt.type === 'error' ? 'bg-red-400'
                    : evt.type === 'warning' ? 'bg-yellow-400'
                    : 'bg-blue-400'
                  }`} />
                </div>
                <p className="text-[10px] text-text-secondary">{evt.message}</p>
                <p className="text-[9px] text-text-secondary opacity-60">{new Date(evt.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ---- Empty Workspace ----

function EmptyWorkspace({ onOpenChat }: { onOpenChat: () => void }) {
  return (
    <div className="h-full flex items-center justify-center bg-[#0a0a0f]">
      <div className="text-center max-w-md">
        <div className="text-3xl font-bold text-[#f0c040]/20 font-mono mb-4">HARBINGER</div>
        <p className="text-text-secondary text-sm mb-6">
          Select an agent from the sidebar to begin. Open chat, terminal, browser, or log tabs to interact.
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            { icon: MessageSquare, label: 'Chat with agents', desc: 'Send commands and receive responses' },
            { icon: Terminal, label: 'Terminal access', desc: 'Execute commands in agent containers' },
            { icon: Globe, label: 'Browser view', desc: 'Watch LENS agent navigate the web' },
            { icon: FileText, label: 'Live logs', desc: 'Stream real-time agent output' },
          ].map((item) => (
            <div key={item.label} className="p-3 bg-surface rounded-lg border border-border text-left">
              <item.icon className="w-4 h-4 text-[#f0c040] mb-1.5" />
              <div className="font-medium">{item.label}</div>
              <div className="text-text-secondary text-[10px]">{item.desc}</div>
            </div>
          ))}
        </div>
        <button
          onClick={onOpenChat}
          className="mt-6 px-4 py-2 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-lg text-sm transition-colors"
        >
          Open First Agent Chat
        </button>
      </div>
    </div>
  )
}

export default CommandCenter
