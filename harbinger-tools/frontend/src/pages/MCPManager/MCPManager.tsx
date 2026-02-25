import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Plug, Unplug, Search, ExternalLink, Trash2,
  Terminal, FolderOpen, Globe, Cpu, Shield, Cloud, Bug, BarChart2,
  Zap, Radio, Database, Lock, FlaskConical, Layers, BrainCircuit,
  Target, FileText, ChevronDown,
} from 'lucide-react'
import { useMCPStore } from '../../store/mcpStore'
import { apiClient } from '../../api/client'
import type { MCP, Tool } from '../../types'

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
  'Cloud Security':    { icon: <Cloud className="w-4 h-4" />,         color: 'text-indigo-400',  bg: 'bg-indigo-600/20' },
  'Credential Testing':{ icon: <Lock className="w-4 h-4" />,          color: 'text-red-400',     bg: 'bg-red-600/20' },
  'Exploitation':      { icon: <Zap className="w-4 h-4" />,           color: 'text-red-500',     bg: 'bg-red-700/20' },
  'Binary Analysis':   { icon: <FlaskConical className="w-4 h-4" />, color: 'text-purple-400',  bg: 'bg-purple-600/20' },
  'Forensics & CTF':   { icon: <FileText className="w-4 h-4" />,      color: 'text-lime-400',    bg: 'bg-lime-600/20' },
  'AI Analysis':       { icon: <BrainCircuit className="w-4 h-4" />, color: 'text-fuchsia-400', bg: 'bg-fuchsia-600/20' },
  'Bug Bounty':        { icon: <Bug className="w-4 h-4" />,           color: 'text-yellow-400',  bg: 'bg-yellow-600/20' },
  'Reporting':         { icon: <BarChart2 className="w-4 h-4" />,     color: 'text-emerald-400', bg: 'bg-emerald-600/20' },
}

function getCategoryMeta(cat?: string) {
  return CATEGORIES[cat ?? ''] ?? { icon: <Terminal className="w-4 h-4" />, color: 'text-indigo-400', bg: 'bg-indigo-600/20' }
}

// ── Main Page ──────────────────────────────────────────────────────────────

type Tab = 'tools' | 'servers'

function MCPManager() {
  const { mcps, builtinTools, addMCP, removeMCP, connectMCP, disconnectMCP, toggleTool, updateMCP } = useMCPStore()
  const [tab, setTab] = useState<Tab>('tools')

  // Load real server status from backend on mount
  useEffect(() => {
    apiClient.get<{ servers: Array<{ id: string; status: string; url?: string }> }>('/api/mcp/servers')
      .then((data) => {
        if (data.servers) {
          data.servers.forEach((srv) => {
            updateMCP(srv.id, { status: srv.status === 'connected' ? 'connected' : 'disconnected' })
          })
        }
      })
      .catch(() => {})
  }, [])
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [expandedTool, setExpandedTool] = useState<string | null>(null)

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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold">MCP Manager</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {builtinTools.length} tools &nbsp;&middot;&nbsp; {enabledCount} enabled &nbsp;&middot;&nbsp; {mcps.length} servers
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Add MCP Server
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 px-6 border-b border-border flex-shrink-0">
        {(['tools', 'servers'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {t === 'tools' ? 'Built-in Tools' : 'MCP Servers'}
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
            />
          ) : (
            <ServersTab
              key="servers"
              mcps={mcps}
              onAdd={() => setShowAddModal(true)}
              onRemove={removeMCP}
              onConnect={connectMCP}
              onDisconnect={disconnectMCP}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddMCPModal
            onClose={() => setShowAddModal(false)}
            onAdd={addMCP}
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
}

function ToolsTab({
  categories,
  categoryCounts,
  activeCategory,
  setActiveCategory,
  search,
  setSearch,
  tools,
  expandedTool,
  setExpandedTool,
  onToggle,
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
              placeholder="Search tools..."
              className="w-full bg-surface-light border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Tools List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {tools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                isExpanded={expandedTool === tool.id}
                onToggle={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)}
                onEnableToggle={() => onToggle(tool.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Tool Card ──────────────────────────────────────────────────────────────

interface ToolCardProps {
  tool: Tool
  isExpanded: boolean
  onToggle: () => void
  onEnableToggle: () => void
}

function ToolCard({ tool, isExpanded, onToggle, onEnableToggle }: ToolCardProps) {
  const meta = getCategoryMeta(tool.category)

  return (
    <motion.div
      layout
      className="bg-surface rounded-xl border border-border overflow-hidden"
    >
      <div
        onClick={onToggle}
        className="p-4 flex items-center gap-4 cursor-pointer hover:bg-surface-light/50 transition-colors"
      >
        <div className={`p-2 rounded-lg ${meta.bg} ${meta.color}`}>{meta.icon}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{tool.name}</h3>
            {tool.category && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-light text-text-secondary">
                {tool.category}
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary truncate">{tool.description}</p>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onEnableToggle()
          }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tool.enabled
              ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
              : 'bg-surface-light text-text-secondary hover:bg-surface-light/80'
          }`}
        >
          {tool.enabled ? 'Enabled' : 'Disabled'}
        </button>

        <ChevronDown
          className={`w-5 h-5 text-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
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
              {tool.schema && (
                <div>
                  <p className="text-xs text-text-secondary mb-1">Schema</p>
                  <pre className="block bg-surface-light rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto">{JSON.stringify(tool.schema, null, 2)}</pre>
                </div>
              )}
              <div className="flex gap-4 text-xs text-text-secondary">
                <span>ID: {tool.id}</span>
                {tool.category && <span>Category: {tool.category}</span>}
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
}

const SERVER_ICONS: Record<string, React.ReactNode> = {
  filesystem: <FolderOpen className="w-6 h-6" />,
  terminal: <Terminal className="w-6 h-6" />,
  playwright: <Globe className="w-6 h-6" />,
  'hexstrike-ai': <Zap className="w-6 h-6" />,
  pentagi: <BrainCircuit className="w-6 h-6" />,
  redteam: <Shield className="w-6 h-6" />,
  'mcp-ui': <BarChart2 className="w-6 h-6" />,
}

function ServersTab({ mcps, onAdd, onRemove, onConnect, onDisconnect }: ServersTabProps) {
  if (mcps.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-secondary">
        <Plug className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">No MCP servers</p>
        <p className="text-text-secondary mb-4">No MCP servers configured</p>
        <button onClick={onAdd} className="text-indigo-400 hover:text-indigo-300">
          Add your first MCP server
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
        {mcps.map((mcp) => (
          <motion.div
            key={mcp.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface rounded-xl border border-border p-5"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${
                  mcp.status === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {SERVER_ICONS[mcp.id] ?? <Plug className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{mcp.name}</h3>
                  <p className="text-sm text-text-secondary max-w-lg">{mcp.description}</p>
                  <div className="flex items-center gap-4 mt-2">
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
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
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
                <a
                  href={mcp.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 hover:bg-surface-light text-text-secondary hover:text-white rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => onRemove(mcp.id)}
                  className="p-2 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {mcp.tools.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-text-secondary mb-2">{mcp.tools.length} tools available</p>
                <div className="flex flex-wrap gap-1.5">
                  {mcp.tools.slice(0, 20).map((tool) => (
                    <span key={tool.id} className="text-xs px-2 py-0.5 bg-surface-light rounded-full">
                      {tool.name}
                    </span>
                  ))}
                  {mcp.tools.length > 20 && (
                    <span className="text-xs px-2 py-0.5 bg-surface-light rounded-full text-text-secondary">
                      +{mcp.tools.length - 20} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        ))}
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
  { id: 'hexstrike', name: 'HexStrike AI', description: '150+ security tools', url: '/mcp/hexstrike' },
  { id: 'pentagi', name: 'PentAGI', description: 'Autonomous pentest agent', url: '/mcp/pentagi' },
  { id: 'mcp-ui', name: 'MCP Visualizer', description: 'Real-time visualization', url: '/mcp/ui' },
]

function AddMCPModal({ onClose, onAdd }: AddMCPModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')

  const handleSubmit = () => {
    onAdd({ name, description, url, config: {} })
    onClose()
  }

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setName(preset.name)
    setDescription(preset.description)
    setUrl(preset.url)
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
          <p className="text-text-secondary">Connect to a new MCP server</p>
        </div>

        {/* Presets */}
        <div className="p-6 border-b border-border">
          <p className="text-sm font-medium mb-3">Quick Select</p>
          <div className="grid grid-cols-3 gap-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className="p-3 bg-surface-light hover:bg-surface border border-border rounded-lg text-left transition-colors"
              >
                <p className="font-medium text-sm">{preset.name}</p>
                <p className="text-xs text-text-secondary truncate">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My MCP Server"
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">URL / Command</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/mcp/my-server  or  http://host:port/sse"
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
            />
          </div>

          {/* Type selector removed - using url only */}
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 hover:bg-surface-light rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name || !url}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            Add Server
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default MCPManager
