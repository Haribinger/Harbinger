import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Plug, Unplug, Search, ExternalLink, Trash2,
  Terminal, FolderOpen, Globe, Cpu, Shield, Cloud, Bug, BarChart2,
  Zap, Radio, Database, Lock, FlaskConical, Layers, BrainCircuit,
  Target, FileText, ChevronDown, Settings, RefreshCw, Activity,
  Edit3, Save, X, Copy, Check, AlertCircle, Play, Power,
} from 'lucide-react'
import { useMCPStore } from '../../store/mcpStore'
import { apiClient } from '../../api/client'
import type { MCP, Tool } from '../../types'
import toast from 'react-hot-toast'

// ── Category metadata ──────────────────────────────────────────────────────

const CATEGORIES: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  'All':               { icon: <Layers className="w-4 h-4" />,       color: 'text-white',       bg: 'bg-gray-600/30' },
  'File System':       { icon: <FolderOpen className="w-4 h-4" />,   color: 'text-amber-400',   bg: 'bg-amber-600/20' },
  'Shell':             { icon: <Terminal className="w-4 h-4" />,      color: 'text-green-400',   bg: 'bg-green-600/20' },
  'Search':            { icon: <Search className="w-4 h-4" />,        color: 'text-sky-400',     bg: 'bg-sky-600/20' },
  'Web':               { icon: <Globe className="w-4 h-4" />,         color: 'text-blue-400',    bg: 'bg-blue-600/20' },
  'Agents':            { icon: <BrainCircuit className="w-4 h-4" />, color: 'text-violet-400',  bg: 'bg-violet-600/20' },
  'Infrastructure':    { icon: <Cpu className="w-4 h-4" />,           color: 'text-slate-300',   bg: 'bg-slate-600/20' },
  'Network Scanning':  { icon: <Radio className="w-4 h-4" />,         color: 'text-cyan-400',    bg: 'bg-cyan-600/20' },
  'Web Application':   { icon: <Shield className="w-4 h-4" />,        color: 'text-orange-400',  bg: 'bg-orange-600/20' },
  'Subdomain & OSINT': { icon: <Target className="w-4 h-4" />,        color: 'text-pink-400',    bg: 'bg-pink-600/20' },
  'Enumeration':       { icon: <Database className="w-4 h-4" />,      color: 'text-teal-400',    bg: 'bg-teal-600/20' },
  'Cloud Security':    { icon: <Cloud className="w-4 h-4" />,         color: 'text-sky-400',     bg: 'bg-sky-600/20' },
  'Credential Testing':{ icon: <Lock className="w-4 h-4" />,          color: 'text-red-400',     bg: 'bg-red-600/20' },
  'Exploitation':      { icon: <Zap className="w-4 h-4" />,           color: 'text-red-500',     bg: 'bg-red-700/20' },
  'Binary Analysis':   { icon: <FlaskConical className="w-4 h-4" />, color: 'text-violet-400',  bg: 'bg-violet-600/20' },
  'Forensics & CTF':   { icon: <FileText className="w-4 h-4" />,      color: 'text-lime-400',    bg: 'bg-lime-600/20' },
  'AI Analysis':       { icon: <BrainCircuit className="w-4 h-4" />, color: 'text-fuchsia-400', bg: 'bg-fuchsia-600/20' },
  'Bug Bounty':        { icon: <Bug className="w-4 h-4" />,           color: 'text-yellow-400',  bg: 'bg-yellow-600/20' },
  'Reporting':         { icon: <BarChart2 className="w-4 h-4" />,     color: 'text-emerald-400', bg: 'bg-emerald-600/20' },
}

function getCategoryMeta(cat?: string) {
  return CATEGORIES[cat ?? ''] ?? { icon: <Terminal className="w-4 h-4" />, color: 'text-[#f0c040]', bg: 'bg-[#f0c040]/10' }
}

// ── Main Page ──────────────────────────────────────────────────────────────

type Tab = 'tools' | 'servers'

function MCPManager() {
  const { mcps, builtinTools, addMCP, removeMCP, updateMCP, toggleTool, addBuiltinTool, removeBuiltinTool } = useMCPStore()
  const [tab, setTab] = useState<Tab>('tools')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Load real server status from backend on mount
  useEffect(() => {
    refreshServerStatus()
  }, [])

  const refreshServerStatus = async () => {
    setIsRefreshing(true)
    try {
      const data = await apiClient.get<{ servers: Array<{ id: string; status: string; url?: string; tools?: number }> }>('/api/mcp/servers')
      if (data.servers) {
        data.servers.forEach((srv) => {
          updateMCP(srv.id, { status: srv.status === 'connected' ? 'connected' : 'disconnected' })
        })
      }
    } catch {
      // Backend unavailable — status stays as-is
    }
    setIsRefreshing(false)
  }

  const handleConnect = async (id: string) => {
    const mcp = mcps.find(m => m.id === id)
    if (!mcp) return

    updateMCP(id, { status: 'connected' as any })
    try {
      // Try health check on the MCP URL
      const res = await fetch(`${mcp.url}/health`)
      if (res.ok) {
        updateMCP(id, { status: 'connected' })
        toast.success(`Connected to ${mcp.name}`)
        // Try to discover tools
        try {
          const toolsRes = await fetch(`${mcp.url}/tools`)
          if (toolsRes.ok) {
            const toolsData = await toolsRes.json()
            const tools = Array.isArray(toolsData) ? toolsData : (Array.isArray(toolsData?.tools) ? toolsData.tools : [])
            updateMCP(id, { tools: tools.map((t: any, i: number) => ({
              id: t.id || `${id}-tool-${i}`,
              name: t.name,
              description: t.description || '',
              type: 'mcp' as const,
              category: t.category,
              schema: t.schema || t.inputSchema || { type: 'object', properties: {} },
              enabled: true,
            }))})
          }
        } catch {
          // Tools discovery failed — not fatal
        }
      } else {
        updateMCP(id, { status: 'disconnected' })
        toast.error(`${mcp.name} health check failed`)
      }
    } catch {
      // Notify backend to attempt connect via Docker
      try {
        await apiClient.post('/api/mcp/connect', { serverId: id, url: mcp.url })
        updateMCP(id, { status: 'connected' })
        toast.success(`${mcp.name} connected via backend`)
      } catch {
        updateMCP(id, { status: 'disconnected' })
        toast.error(`Could not connect to ${mcp.name}`)
      }
    }
  }

  const handleDisconnect = async (id: string) => {
    const mcp = mcps.find(m => m.id === id)
    updateMCP(id, { status: 'disconnected', tools: [] })
    try {
      await apiClient.post('/api/mcp/disconnect', { serverId: id })
    } catch {
      // Backend unreachable — local state already updated
    }
    toast(`${mcp?.name || id} disconnected`)
  }

  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [expandedTool, setExpandedTool] = useState<string | null>(null)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  const [detailServer, setDetailServer] = useState<string | null>(null)

  // Build category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: builtinTools.length }
    builtinTools.forEach((t) => {
      const cat = t.category ?? 'Other'
      counts[cat] = (counts[cat] ?? 0) + 1
    })
    return counts
  }, [builtinTools])

  const orderedCategories = useMemo(() => {
    return ['All', ...Object.keys(CATEGORIES).filter((c) => c !== 'All' && (categoryCounts[c] ?? 0) > 0)]
  }, [categoryCounts])

  const filteredTools = useMemo(() => {
    return builtinTools.filter((t) => {
      const matchCat = activeCategory === 'All' || t.category === activeCategory
      const q = search.toLowerCase()
      const matchSearch = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || (t.category ?? '').toLowerCase().includes(q)
      return matchCat && matchSearch
    })
  }, [builtinTools, activeCategory, search])

  const enabledCount = builtinTools.filter((t) => t.enabled).length
  const connectedCount = mcps.filter((m) => m.status === 'connected').length

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold">MCP Manager</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {builtinTools.length} tools &middot; {enabledCount} enabled &middot; {mcps.length} servers &middot; {connectedCount} connected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshServerStatus}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-surface-light transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add MCP Server
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 px-6 border-b border-border flex-shrink-0">
        {(['tools', 'servers'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-[#f0c040] text-[#f0c040]'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {t === 'tools' ? `Built-in Tools (${builtinTools.length})` : `MCP Servers (${mcps.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {tab === 'tools' ? (
            <ToolsTab
              key="tools"
              categories={orderedCategories}
              categoryCounts={categoryCounts}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              search={search}
              setSearch={setSearch}
              tools={filteredTools}
              expandedTool={expandedTool}
              setExpandedTool={setExpandedTool}
              onToggle={toggleTool}
              editingTool={editingTool}
              setEditingTool={setEditingTool}
            />
          ) : (
            <ServersTab
              key="servers"
              mcps={mcps}
              onAdd={() => setShowAddModal(true)}
              onRemove={removeMCP}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onUpdate={updateMCP}
              detailServer={detailServer}
              setDetailServer={setDetailServer}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAddModal && (
          <AddMCPModal
            onClose={() => setShowAddModal(false)}
            onAdd={(mcp) => {
              addMCP(mcp)
              toast.success(`Added ${mcp.name}`)
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Tools Tab ──────────────────────────────────────────────────────────────

interface ToolsTabProps {
  categories: string[]
  categoryCounts: Record<string, number>
  activeCategory: string
  setActiveCategory: (c: string) => void
  search: string
  setSearch: (s: string) => void
  tools: Tool[]
  expandedTool: string | null
  setExpandedTool: (id: string | null) => void
  onToggle: (id: string) => void
  editingTool: Tool | null
  setEditingTool: (tool: Tool | null) => void
}

function ToolsTab({
  categories, categoryCounts, activeCategory, setActiveCategory,
  search, setSearch, tools, expandedTool, setExpandedTool, onToggle,
  editingTool, setEditingTool,
}: ToolsTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="h-full flex"
    >
      {/* Sidebar */}
      <div className="w-56 border-r border-border overflow-y-auto p-4 flex-shrink-0">
        <div className="space-y-1">
          {categories.map((cat) => {
            const meta = getCategoryMeta(cat)
            const count = categoryCounts[cat] ?? 0
            const isActive = activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-surface-light text-white'
                    : 'text-text-secondary hover:bg-surface-light/50 hover:text-text-primary'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={meta.color}>{meta.icon}</span>
                  <span>{cat}</span>
                </div>
                <span className="text-xs text-text-secondary">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tools by name, description, or category..."
              className="w-full bg-surface-light border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Tools List */}
        <div className="flex-1 overflow-y-auto p-4">
          {tools.length === 0 ? (
            <div className="text-center text-text-secondary py-12">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No tools match your search</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tools.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  isExpanded={expandedTool === tool.id}
                  isEditing={editingTool?.id === tool.id}
                  onToggle={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)}
                  onEnableToggle={() => onToggle(tool.id)}
                  onEdit={() => setEditingTool(tool)}
                  onCancelEdit={() => setEditingTool(null)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Tool Card ──────────────────────────────────────────────────────────────

interface ToolCardProps {
  tool: Tool
  isExpanded: boolean
  isEditing: boolean
  onToggle: () => void
  onEnableToggle: () => void
  onEdit: () => void
  onCancelEdit: () => void
}

function ToolCard({ tool, isExpanded, isEditing, onToggle, onEnableToggle, onEdit, onCancelEdit }: ToolCardProps) {
  const meta = getCategoryMeta(tool.category)
  const { updateMCP } = useMCPStore()
  const [editConfig, setEditConfig] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isEditing && tool.config) {
      const cfg: Record<string, string> = {}
      Object.entries(tool.config).forEach(([k, v]) => { cfg[k] = String(v) })
      setEditConfig(cfg)
    }
  }, [isEditing])

  const copySchema = () => {
    navigator.clipboard.writeText(JSON.stringify(tool.schema, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    toast.success('Schema copied')
  }

  return (
    <motion.div layout className="bg-surface rounded-xl border border-border overflow-hidden">
      <div
        onClick={onToggle}
        className="p-4 flex items-center gap-4 cursor-pointer hover:bg-surface-light/50 transition-colors"
      >
        <div className={`p-2 rounded-lg ${meta.bg} ${meta.color}`}>{meta.icon}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{tool.name}</h3>
            {tool.type && tool.type !== 'builtin' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 uppercase font-medium">{tool.type}</span>
            )}
            {tool.category && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-light text-text-secondary">{tool.category}</span>
            )}
          </div>
          <p className="text-sm text-text-secondary truncate">{tool.description}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEnableToggle() }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tool.enabled
                ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                : 'bg-surface-light text-text-secondary hover:bg-surface-light/80'
            }`}
          >
            {tool.enabled ? 'Enabled' : 'Disabled'}
          </button>

          <ChevronDown className={`w-5 h-5 text-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border"
          >
            <div className="p-4 space-y-3">
              {/* Schema */}
              {tool.schema && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-text-secondary">Parameters</p>
                    <button onClick={copySchema} className="text-xs text-text-secondary hover:text-white flex items-center gap-1">
                      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  {tool.schema.properties && Object.keys(tool.schema.properties).length > 0 ? (
                    <div className="space-y-1.5">
                      {Object.entries(tool.schema.properties).map(([key, prop]) => (
                        <div key={key} className="flex items-start gap-2 text-xs">
                          <code className="font-mono text-[#f0c040] bg-surface-light px-1.5 py-0.5 rounded flex-shrink-0">
                            {key}
                            {tool.schema.required?.includes(key) && <span className="text-red-400 ml-0.5">*</span>}
                          </code>
                          <span className="text-text-secondary">{prop.description}</span>
                          {prop.enum && (
                            <span className="text-sky-400 ml-auto flex-shrink-0">[{prop.enum.join(' | ')}]</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre className="block bg-surface-light rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto">
                      {JSON.stringify(tool.schema, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {/* Config (if any) */}
              {tool.config && Object.keys(tool.config).length > 0 && (
                <div>
                  <p className="text-xs text-text-secondary mb-1">Configuration</p>
                  <div className="bg-surface-light rounded-lg px-3 py-2">
                    {Object.entries(tool.config).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 text-xs py-0.5">
                        <span className="text-text-secondary">{k}:</span>
                        <span className="font-mono">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-text-secondary pt-1">
                <span className="font-mono">ID: {tool.id}</span>
                <span>Type: {tool.type}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Servers Tab ─────────────────────────────────────────────────────────────

interface ServersTabProps {
  mcps: MCP[]
  onAdd: () => void
  onRemove: (id: string) => void
  onConnect: (id: string) => void
  onDisconnect: (id: string) => void
  onUpdate: (id: string, updates: Partial<MCP>) => void
  detailServer: string | null
  setDetailServer: (id: string | null) => void
}

const SERVER_ICONS: Record<string, React.ReactNode> = {
  hexstrike: <Zap className="w-6 h-6" />,
  pentagi: <BrainCircuit className="w-6 h-6" />,
  redteam: <Shield className="w-6 h-6" />,
  'mcp-ui': <BarChart2 className="w-6 h-6" />,
}

function ServersTab({ mcps, onAdd, onRemove, onConnect, onDisconnect, onUpdate, detailServer, setDetailServer }: ServersTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editDockerService, setEditDockerService] = useState('')

  const startEdit = (mcp: MCP) => {
    setEditingId(mcp.id)
    setEditName(mcp.name)
    setEditUrl(mcp.url)
    setEditDesc(mcp.description)
    setEditDockerService(String(mcp.config?.dockerService || ''))
  }

  const saveEdit = () => {
    if (!editingId) return
    onUpdate(editingId, {
      name: editName,
      url: editUrl,
      description: editDesc,
      config: { dockerService: editDockerService || undefined },
    })
    setEditingId(null)
    toast.success('Server configuration saved')
  }

  if (mcps.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-secondary">
        <Plug className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">No MCP servers</p>
        <p className="text-text-secondary mb-4">Add an MCP server to get started</p>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Add MCP Server
        </button>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="h-full overflow-y-auto p-6"
    >
      <div className="space-y-4">
        {mcps.map((mcp) => {
          const isEditing = editingId === mcp.id
          const isDetail = detailServer === mcp.id

          return (
            <motion.div
              key={mcp.id}
              layout
              className="bg-surface rounded-xl border border-border overflow-hidden"
            >
              {/* Server header */}
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${
                      mcp.status === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {SERVER_ICONS[mcp.id] ?? <Plug className="w-6 h-6" />}
                    </div>
                    <div className="min-w-0">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-[#f0c040]"
                          />
                          <input
                            type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                            placeholder="Description"
                            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                          />
                          <input
                            type="text" value={editUrl} onChange={(e) => setEditUrl(e.target.value)}
                            placeholder="URL or proxy path"
                            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none"
                          />
                          <input
                            type="text" value={editDockerService} onChange={(e) => setEditDockerService(e.target.value)}
                            placeholder="Docker service name (optional)"
                            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#f0c040]/20 text-[#f0c040] rounded-lg hover:bg-[#f0c040]/30">
                              <Save className="w-3 h-3" /> Save
                            </button>
                            <button onClick={() => setEditingId(null)} className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-surface-light">
                              <X className="w-3 h-3" /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3 className="font-semibold text-lg">{mcp.name}</h3>
                          <p className="text-sm text-text-secondary max-w-lg">{mcp.description}</p>
                          <div className="flex items-center gap-4 mt-2 flex-wrap">
                            <span className={`flex items-center gap-1.5 text-xs ${
                              mcp.status === 'connected' ? 'text-green-400' : 'text-gray-400'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${
                                mcp.status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                              }`} />
                              {mcp.status}
                            </span>
                            <span className="text-xs font-mono text-text-secondary">{mcp.url}</span>
                            {Boolean(mcp.config?.dockerService) && (
                              <span className="text-xs text-sky-400 bg-sky-900/30 px-2 py-0.5 rounded-full">
                                {String(mcp.config?.dockerService)}
                              </span>
                            )}
                            {mcp.tools.length > 0 && (
                              <span className="text-xs text-[#f0c040] bg-[#f0c040]/10 px-2 py-0.5 rounded-full">
                                {mcp.tools.length} tools
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => startEdit(mcp)}
                        className="p-2 hover:bg-surface-light text-text-secondary hover:text-white rounded-lg transition-colors"
                        title="Edit server config"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      {mcp.status === 'connected' ? (
                        <button
                          onClick={() => onDisconnect(mcp.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
                        >
                          <Unplug className="w-3.5 h-3.5" />
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => onConnect(mcp.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                        >
                          <Plug className="w-3.5 h-3.5" />
                          Connect
                        </button>
                      )}
                      <button
                        onClick={() => setDetailServer(isDetail ? null : mcp.id)}
                        className="p-2 hover:bg-surface-light text-text-secondary hover:text-white rounded-lg transition-colors"
                        title="Show details"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${isDetail ? 'rotate-180' : ''}`} />
                      </button>
                      <button
                        onClick={() => {
                          onRemove(mcp.id)
                          toast(`Removed ${mcp.name}`)
                        }}
                        className="p-2 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors"
                        title="Remove server"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded detail panel */}
              <AnimatePresence>
                {isDetail && !isEditing && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border"
                  >
                    <div className="p-5 space-y-4">
                      {/* Configuration */}
                      <div>
                        <h4 className="text-xs text-text-secondary font-medium mb-2">Server Configuration</h4>
                        <div className="bg-surface-light rounded-lg p-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-text-secondary">Endpoint</span>
                            <span className="font-mono">{mcp.url}</span>
                          </div>
                          {mcp.config && Object.entries(mcp.config).map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between text-xs">
                              <span className="text-text-secondary">{k}</span>
                              <span className="font-mono">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Tools discovered from this server */}
                      {mcp.tools.length > 0 && (
                        <div>
                          <h4 className="text-xs text-text-secondary font-medium mb-2">Discovered Tools ({mcp.tools.length})</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {mcp.tools.map((tool) => (
                              <div key={tool.id} className="px-3 py-2 bg-surface-light rounded-lg">
                                <p className="text-sm font-medium truncate">{tool.name}</p>
                                <p className="text-[10px] text-text-secondary truncate">{tool.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Resources */}
                      {mcp.resources && mcp.resources.length > 0 && (
                        <div>
                          <h4 className="text-xs text-text-secondary font-medium mb-2">Resources ({mcp.resources.length})</h4>
                          <div className="space-y-1">
                            {mcp.resources.map((res, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <span className="font-mono text-[#f0c040]">{res.uri}</span>
                                <span className="text-text-secondary">{res.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Prompts */}
                      {mcp.prompts && mcp.prompts.length > 0 && (
                        <div>
                          <h4 className="text-xs text-text-secondary font-medium mb-2">Prompts ({mcp.prompts.length})</h4>
                          <div className="space-y-1">
                            {mcp.prompts.map((p, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <span className="font-medium">{p.name}</span>
                                <span className="text-text-secondary">{p.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2">
                        <a
                          href={mcp.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-surface-light transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" /> Open Endpoint
                        </a>
                        <button
                          onClick={() => onConnect(mcp.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-surface-light transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" /> Re-discover Tools
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ── Add MCP Modal ───────────────────────────────────────────────────────────

interface AddMCPModalProps {
  onClose: () => void
  onAdd: (mcp: { name: string; description: string; url: string; config?: Record<string, unknown> }) => void
}

const PRESETS = [
  { id: 'hexstrike', name: 'HexStrike AI', description: '150+ offensive security tools — scanning, exploitation, fuzzing, binary analysis', url: '/mcp/hexstrike', docker: 'harbinger-hexstrike' },
  { id: 'pentagi', name: 'PentAGI Agent', description: 'Autonomous penetration testing agent with multi-step planning and execution', url: '/mcp/pentagi', docker: 'harbinger-pentagi' },
  { id: 'mcp-ui', name: 'MCP Visualizer', description: 'Real-time visualization of active tools, scan results, and agent workflows', url: '/mcp/ui', docker: 'harbinger-mcp-ui' },
  { id: 'redteam', name: 'Red Team Ops', description: 'C2 management, SOCKS proxy, playbooks, Neo4j AD analysis, credential parsers', url: '/api/redteam', docker: 'harbinger-redteam' },
]

function AddMCPModal({ onClose, onAdd }: AddMCPModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [dockerService, setDockerService] = useState('')

  const handleSubmit = () => {
    onAdd({
      name,
      description,
      url,
      config: dockerService ? { dockerService } : {},
    })
    onClose()
  }

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setName(preset.name)
    setDescription(preset.description)
    setUrl(preset.url)
    setDockerService(preset.docker)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold">Add MCP Server</h2>
          <p className="text-text-secondary text-sm">Connect a new MCP server or select a preset</p>
        </div>

        {/* Presets */}
        <div className="p-6 border-b border-border">
          <p className="text-sm font-medium mb-3">Harbinger MCP Plugins</p>
          <div className="grid grid-cols-2 gap-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className="p-3 bg-surface-light hover:bg-surface border border-border rounded-lg text-left transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  {SERVER_ICONS[preset.id] ?? <Plug className="w-4 h-4" />}
                  <p className="font-medium text-sm">{preset.name}</p>
                </div>
                <p className="text-xs text-text-secondary line-clamp-2">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Server Name</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="My MCP Server"
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#f0c040]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <input
              type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What this server provides"
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#f0c040]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Endpoint URL</label>
            <input
              type="text" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="/mcp/my-server  or  http://host:port/sse"
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-[#f0c040]"
            />
            <p className="text-xs text-text-secondary mt-1">
              Use relative paths for proxy-routed servers, full URLs for external servers
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Docker Service (optional)</label>
            <input
              type="text" value={dockerService} onChange={(e) => setDockerService(e.target.value)}
              placeholder="harbinger-my-mcp"
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-[#f0c040]"
            />
            <p className="text-xs text-text-secondary mt-1">
              Docker Compose service name — used for auto-start on connect
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 hover:bg-surface-light rounded-lg transition-colors text-sm">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name || !url}
            className="px-4 py-2 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 disabled:opacity-50 rounded-lg transition-colors text-sm"
          >
            Add Server
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default MCPManager
