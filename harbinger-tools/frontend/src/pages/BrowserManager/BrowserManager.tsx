import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Globe,
  Trash2,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Home,
  Camera,
  Code,
  Wifi,
  WifiOff,
  AlertTriangle,
  Info,
  Search,
  X,
  Bot,
  Eye,
  Play,
  Terminal,
  Monitor,
} from 'lucide-react'
import { useBrowserStore } from '../../store/browserStore'
import { browserApi } from '../../api/browser'
import type { BrowserSession } from '../../types'
import toast from 'react-hot-toast'

function statusColor(status: BrowserSession['status']) {
  switch (status) {
    case 'active': return 'bg-green-500/10 text-green-400 border-green-500/20'
    case 'inactive': return 'bg-surface-light text-text-secondary border-border'
    case 'error': return 'bg-red-500/10 text-red-400 border-red-500/20'
  }
}

function BrowserManager() {
  const {
    sessions,
    selectedSession,
    setSelectedSession,
    addSession,
    removeSession,
    updateSession,
    consoleFilters,
    networkFilters,
    setConsoleFilters,
    setNetworkFilters,
    clearConsoleLogs,
    clearNetworkRequests,
    setSessions,
  } = useBrowserStore()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'console' | 'network' | 'screenshot' | 'actions'>('console')
  const [urlInput, setUrlInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [jsInput, setJsInput] = useState('')
  const [browserStats, setBrowserStats] = useState<{ totalSessions: number; activeSessions: number; agentSessions: number } | null>(null)

  useEffect(() => {
    loadSessions()
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSessions = async () => {
    try {
      const data = await browserApi.getSessions()
      setSessions(data)
    } catch {
      /* Browser API not available — degrade to local sessions */
    }
  }

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('harbinger-token')
      const res = await fetch('/api/browsers/stats', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setBrowserStats(data)
      }
    } catch { /* stats are optional */ }
  }

  const handleCreate = async (data: { name: string; url: string; width: number; height: number; agentId?: string }) => {
    setIsLoading(true)
    try {
      const session = await browserApi.createSession({
        url: data.url,
        headless: false,
        viewport: { width: data.width, height: data.height },
      })
      const sessionWithName = { ...session, name: data.name }
      addSession(sessionWithName)
      setShowCreateModal(false)
      setSelectedSession(sessionWithName)
      loadStats()
      toast.success('Browser session launched!')
    } catch {
      const localSession: BrowserSession = {
        id: `b-${Date.now()}`,
        name: data.name,
        url: data.url,
        status: 'active',
        viewport: { width: data.width, height: data.height },
        devtoolsOpen: false,
        consoleLogs: [],
        networkRequests: [],
        createdAt: new Date().toISOString(),
      }
      addSession(localSession)
      setShowCreateModal(false)
      setSelectedSession(localSession)
      toast.success('Local browser session created')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCloseSession = async (id: string) => {
    try {
      await browserApi.closeSession(id)
    } catch { /* remove locally regardless */ }
    removeSession(id)
    loadStats()
    toast.success('Session closed')
  }

  const handleTakeScreenshot = async () => {
    if (!selectedSession) return
    try {
      const { data } = await browserApi.takeScreenshot(selectedSession.id)
      updateSession(selectedSession.id, { screenshot: data })
      setActiveTab('screenshot')
      toast.success('Screenshot captured!')
    } catch {
      toast.error('Failed to capture screenshot')
    }
  }

  const handleNavigate = async (url: string) => {
    if (!selectedSession || !url) return
    try {
      await browserApi.navigate(selectedSession.id, url)
      updateSession(selectedSession.id, { url })
    } catch {
      toast.error('Failed to navigate')
    }
  }

  const handleExecuteJS = async () => {
    if (!selectedSession || !jsInput.trim()) return
    try {
      await browserApi.executeScript(selectedSession.id, jsInput)
      toast.success('Script executed')
      setJsInput('')
    } catch {
      toast.error('Failed to execute script')
    }
  }

  const handleClick = async (selector: string) => {
    if (!selectedSession) return
    try {
      await browserApi.clickElement(selectedSession.id, selector)
      toast.success(`Clicked ${selector}`)
    } catch {
      toast.error('Click failed')
    }
  }

  const consoleLogs = selectedSession?.consoleLogs || []
  const networkRequests = selectedSession?.networkRequests || []

  const filteredConsole = consoleLogs.filter((log) => {
    if (consoleFilters.level && log.level !== consoleFilters.level) return false
    if (consoleFilters.search && !log.message.toLowerCase().includes(consoleFilters.search.toLowerCase())) return false
    return true
  })

  const filteredNetwork = networkRequests.filter((req) => {
    if (networkFilters.method && req.method !== networkFilters.method) return false
    if (networkFilters.search && !req.url.toLowerCase().includes(networkFilters.search.toLowerCase())) return false
    return true
  })

  const consoleIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
      case 'warn': return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
      case 'info': return <Info className="w-3.5 h-3.5 text-blue-400" />
      default: return <Code className="w-3.5 h-3.5 text-text-secondary" />
    }
  }

  const statusCodeColor = (code?: number) => {
    if (!code) return 'text-text-secondary'
    if (code < 300) return 'text-green-400'
    if (code < 400) return 'text-yellow-400'
    return 'text-red-400'
  }

  const agentSessions = sessions.filter((s) => s.agentId || s.agentName)
  const manualSessions = sessions.filter((s) => !s.agentId && !s.agentName)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex overflow-hidden"
    >
      {/* Session List */}
      <div className="w-72 border-r border-border flex flex-col bg-surface">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#f0c040]" />
                Browser Use
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">CDP Visual Control — All Local</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-2 bg-[#f0c040]/10 border border-[#f0c040]/30 text-[#f0c040] hover:bg-[#f0c040]/20 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            <span className="flex items-center gap-1">
              <Monitor className="w-3 h-3" />
              {sessions.length} sessions
            </span>
            {browserStats && browserStats.agentSessions > 0 && (
              <span className="flex items-center gap-1">
                <Bot className="w-3 h-3 text-[#f0c040]" />
                {browserStats.agentSessions} agent
              </span>
            )}
            <button onClick={() => { loadSessions(); loadStats() }} className="ml-auto hover:text-white">
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-text-secondary px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl border border-[#1a1a2e] bg-[#0d0d15] flex items-center justify-center">
                <Eye className="w-8 h-8 opacity-30" />
              </div>
              <p className="text-sm font-medium mb-1">No browser sessions</p>
              <p className="text-xs opacity-60 mb-3">Every agent can have eyes. No API keys needed.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-[#f0c040] text-sm hover:text-[#f0c040]/80"
              >
                Launch a browser
              </button>
            </div>
          ) : (
            <>
              {/* Agent-owned sessions */}
              {agentSessions.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] uppercase tracking-wider text-text-secondary px-2 py-1 flex items-center gap-1">
                    <Bot className="w-3 h-3" /> Agent Browsers
                  </div>
                  {agentSessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      selected={selectedSession?.id === session.id}
                      onSelect={() => setSelectedSession(session)}
                      onClose={() => handleCloseSession(session.id)}
                    />
                  ))}
                </div>
              )}

              {/* Manual sessions */}
              {manualSessions.length > 0 && (
                <div>
                  {agentSessions.length > 0 && (
                    <div className="text-[10px] uppercase tracking-wider text-text-secondary px-2 py-1 flex items-center gap-1">
                      <Globe className="w-3 h-3" /> Manual Sessions
                    </div>
                  )}
                  {manualSessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      selected={selectedSession?.id === session.id}
                      onSelect={() => setSelectedSession(session)}
                      onClose={() => handleCloseSession(session.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* No API keys notice */}
        <div className="p-3 border-t border-border">
          <div className="bg-[#0d0d15] border border-[#1a1a2e] rounded-lg p-3 text-xs text-text-secondary">
            <div className="flex items-center gap-2 mb-1.5 text-[#f0c040] font-medium">
              <Eye className="w-3.5 h-3.5" />
              Local Chrome via CDP
            </div>
            <p className="leading-relaxed">No Brave API. No OpenAI credits. No rate limits. Every agent has eyes — you see what they see.</p>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedSession ? (
          <>
            {/* Browser Toolbar */}
            <div className="border-b border-border p-3 flex items-center gap-2">
              <button className="p-2 hover:bg-surface-light rounded-lg text-text-secondary transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button className="p-2 hover:bg-surface-light rounded-lg text-text-secondary transition-colors">
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={loadSessions}
                className="p-2 hover:bg-surface-light rounded-lg text-text-secondary transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button className="p-2 hover:bg-surface-light rounded-lg text-text-secondary transition-colors">
                <Home className="w-4 h-4" />
              </button>

              {/* Agent badge */}
              {(selectedSession as unknown as Record<string, string>).agentName && (
                <span className="px-2 py-0.5 bg-[#f0c040]/10 border border-[#f0c040]/30 text-[#f0c040] rounded text-xs font-medium flex items-center gap-1">
                  <Bot className="w-3 h-3" />
                  {(selectedSession as unknown as Record<string, string>).agentName}
                </span>
              )}

              <div className="flex-1 relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type="text"
                  value={urlInput || selectedSession.url}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && urlInput) {
                      handleNavigate(urlInput)
                      setUrlInput('')
                    }
                  }}
                  placeholder="https://"
                  className="w-full bg-surface-light border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <button
                onClick={handleTakeScreenshot}
                className="p-2 hover:bg-[#f0c040]/10 text-[#f0c040] rounded-lg transition-colors"
                title="Take screenshot"
              >
                <Camera className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleCloseSession(selectedSession.id)}
                className="p-2 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Viewport Preview */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 bg-[#0d0d15] relative overflow-hidden" style={{ minHeight: '200px', maxHeight: '40%' }}>
                {selectedSession.screenshot ? (
                  <img src={selectedSession.screenshot} alt="Browser preview" className="w-full h-full object-contain" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-text-secondary">
                      <div className="w-20 h-14 mx-auto mb-3 border border-[#1a1a2e] rounded-lg flex items-center justify-center bg-[#0a0a0f]">
                        <Globe className="w-8 h-8 opacity-20" />
                      </div>
                      <p className="text-sm font-mono text-[#f0c040]/60">{selectedSession.url}</p>
                      <p className="text-xs mt-1 opacity-40">
                        {selectedSession.viewport.width}x{selectedSession.viewport.height} — Chrome DevTools Protocol
                      </p>
                      <button
                        onClick={handleTakeScreenshot}
                        className="mt-3 text-xs text-[#f0c040] hover:text-[#f0c040]/80 flex items-center gap-1 mx-auto"
                      >
                        <Camera className="w-3 h-3" />
                        Capture viewport
                      </button>
                    </div>
                  </div>
                )}

                {selectedSession.screenshot && (
                  <button
                    onClick={handleTakeScreenshot}
                    className="absolute bottom-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors"
                    title="Refresh screenshot"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* DevTools Panel */}
              <div className="flex-1 border-t border-border flex flex-col overflow-hidden">
                <div className="flex items-center border-b border-border px-4 gap-4">
                  {(['console', 'network', 'screenshot', 'actions'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`py-2 text-sm font-medium capitalize relative transition-colors ${
                        activeTab === tab ? 'text-[#f0c040]' : 'text-text-secondary hover:text-white'
                      }`}
                    >
                      {tab}
                      {tab === 'console' && consoleLogs.length > 0 && (
                        <span className="ml-1.5 text-xs bg-surface-light text-text-secondary px-1.5 rounded-full">
                          {consoleLogs.length}
                        </span>
                      )}
                      {tab === 'network' && networkRequests.length > 0 && (
                        <span className="ml-1.5 text-xs bg-surface-light text-text-secondary px-1.5 rounded-full">
                          {networkRequests.length}
                        </span>
                      )}
                      {activeTab === tab && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#f0c040]" />
                      )}
                    </button>
                  ))}

                  <div className="ml-auto flex items-center gap-2">
                    {activeTab === 'console' && (
                      <>
                        <select
                          value={consoleFilters.level || ''}
                          onChange={(e) => setConsoleFilters({ level: e.target.value || null })}
                          className="text-xs bg-surface-light border border-border rounded px-2 py-1 focus:outline-none"
                        >
                          <option value="">All levels</option>
                          <option value="log">Log</option>
                          <option value="info">Info</option>
                          <option value="warn">Warn</option>
                          <option value="error">Error</option>
                        </select>
                        <button
                          onClick={() => clearConsoleLogs(selectedSession.id)}
                          className="text-xs text-text-secondary hover:text-white px-2 py-1 hover:bg-surface-light rounded"
                        >
                          Clear
                        </button>
                      </>
                    )}
                    {activeTab === 'network' && (
                      <>
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-secondary" />
                          <input
                            type="text"
                            placeholder="Filter URLs"
                            value={networkFilters.search}
                            onChange={(e) => setNetworkFilters({ search: e.target.value })}
                            className="pl-6 pr-2 py-1 text-xs bg-surface-light border border-border rounded focus:outline-none w-36"
                          />
                        </div>
                        <button
                          onClick={() => clearNetworkRequests(selectedSession.id)}
                          className="text-xs text-text-secondary hover:text-white px-2 py-1 hover:bg-surface-light rounded"
                        >
                          Clear
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto font-mono text-xs">
                  {activeTab === 'console' && (
                    <div>
                      {filteredConsole.length === 0 ? (
                        <div className="text-center py-10 text-text-secondary text-sm font-sans">
                          No console output
                        </div>
                      ) : (
                        filteredConsole.map((log, i) => (
                          <div
                            key={i}
                            className={`flex items-start gap-2 px-4 py-1.5 border-b border-border/50 hover:bg-surface-light ${
                              log.level === 'error' ? 'bg-red-500/5' :
                              log.level === 'warn' ? 'bg-yellow-500/5' : ''
                            }`}
                          >
                            <span className="mt-0.5 flex-shrink-0">{consoleIcon(log.level)}</span>
                            <span className="text-text-secondary flex-shrink-0 text-[10px]">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={`flex-1 break-all ${
                              log.level === 'error' ? 'text-red-400' :
                              log.level === 'warn' ? 'text-yellow-400' :
                              log.level === 'info' ? 'text-blue-400' :
                              'text-text-primary'
                            }`}>
                              {log.message}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === 'network' && (
                    <div>
                      {filteredNetwork.length === 0 ? (
                        <div className="text-center py-10 text-text-secondary text-sm font-sans">
                          No network requests
                        </div>
                      ) : (
                        <table className="w-full">
                          <thead className="sticky top-0 bg-surface border-b border-border">
                            <tr className="text-left text-text-secondary">
                              <th className="px-4 py-2 font-medium">Method</th>
                              <th className="px-4 py-2 font-medium">Status</th>
                              <th className="px-4 py-2 font-medium flex-1">URL</th>
                              <th className="px-4 py-2 font-medium">Size</th>
                              <th className="px-4 py-2 font-medium">Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredNetwork.map((req) => (
                              <tr key={req.id} className="border-b border-border/50 hover:bg-surface-light">
                                <td className="px-4 py-1.5">
                                  <span className="text-blue-400">{req.method}</span>
                                </td>
                                <td className="px-4 py-1.5">
                                  <span className={statusCodeColor(req.status)}>{req.status || '\u2014'}</span>
                                </td>
                                <td className="px-4 py-1.5 max-w-xs">
                                  <span className="truncate block text-text-secondary">{req.url}</span>
                                </td>
                                <td className="px-4 py-1.5 text-text-secondary">
                                  {req.size ? `${(req.size / 1024).toFixed(1)}kb` : '\u2014'}
                                </td>
                                <td className="px-4 py-1.5 text-text-secondary">
                                  {req.time ? `${req.time}ms` : '\u2014'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {activeTab === 'screenshot' && (
                    <div className="p-4 font-sans">
                      {selectedSession.screenshot ? (
                        <div>
                          <img
                            src={selectedSession.screenshot}
                            alt="Screenshot"
                            className="max-w-full rounded-lg border border-border"
                          />
                          <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
                            <Camera className="w-3 h-3" />
                            <span>Visual feed from {(selectedSession as unknown as Record<string, string>).agentName || selectedSession.name}</span>
                            <button
                              onClick={handleTakeScreenshot}
                              className="ml-auto text-[#f0c040] hover:text-[#f0c040]/80"
                            >
                              Refresh
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-10 text-text-secondary">
                          <Camera className="w-10 h-10 mx-auto mb-3 opacity-40" />
                          <p>No screenshot taken yet</p>
                          <p className="text-xs mt-1">Click the camera icon to capture what the agent sees</p>
                          <button
                            onClick={handleTakeScreenshot}
                            className="mt-3 px-3 py-1.5 bg-[#f0c040]/10 border border-[#f0c040]/30 text-[#f0c040] rounded-lg text-xs"
                          >
                            Capture Now
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'actions' && (
                    <div className="p-4 font-sans space-y-4">
                      {/* Execute JS */}
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-text-secondary uppercase tracking-wider">
                          Execute JavaScript
                        </label>
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary" />
                            <input
                              type="text"
                              value={jsInput}
                              onChange={(e) => setJsInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleExecuteJS() }}
                              placeholder="document.title"
                              className="w-full bg-surface-light border border-border rounded-lg pl-9 pr-4 py-2 text-sm font-mono focus:outline-none focus:border-[#f0c040]"
                            />
                          </div>
                          <button
                            onClick={handleExecuteJS}
                            disabled={!jsInput.trim()}
                            className="px-3 py-2 bg-[#f0c040]/10 border border-[#f0c040]/30 text-[#f0c040] rounded-lg hover:bg-[#f0c040]/20 disabled:opacity-30 transition-colors"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-text-secondary uppercase tracking-wider">
                          Quick Actions
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: 'Get page title', script: 'document.title' },
                            { label: 'Count links', script: 'document.querySelectorAll("a").length' },
                            { label: 'Count forms', script: 'document.querySelectorAll("form").length' },
                            { label: 'Count inputs', script: 'document.querySelectorAll("input").length' },
                            { label: 'Find passwords', script: 'document.querySelectorAll("input[type=password]").length' },
                            { label: 'Check cookies', script: 'document.cookie.split(";").length' },
                          ].map((action) => (
                            <button
                              key={action.label}
                              onClick={() => {
                                setJsInput(action.script)
                                browserApi.executeScript(selectedSession.id, action.script).catch(() => { /* script execution error visible in console tab */ })
                              }}
                              className="p-2.5 text-left bg-surface-light border border-border rounded-lg hover:border-[#f0c040]/30 transition-colors"
                            >
                              <span className="text-xs font-medium">{action.label}</span>
                              <span className="block text-[10px] text-text-secondary font-mono mt-0.5 truncate">{action.script}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Click element */}
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-text-secondary uppercase tracking-wider">
                          Click Element
                        </label>
                        <ClickAction onSubmit={(selector) => handleClick(selector)} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-secondary">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 mx-auto mb-6 rounded-xl border border-[#1a1a2e] bg-[#0d0d15] flex items-center justify-center">
                <Eye className="w-10 h-10 opacity-30 text-[#f0c040]" />
              </div>
              <p className="text-lg font-medium text-white mb-1">Browser Use — Agent Eyes</p>
              <p className="text-sm mb-4 leading-relaxed">
                Every agent gets a real Chrome browser via CDP. No API keys, no rate limits, no black boxes.
                You see exactly what they see.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs mb-6">
                {[
                  'Navigate pages',
                  'Take screenshots',
                  'Execute JavaScript',
                  'Click elements',
                  'Read console logs',
                  'Inspect network',
                ].map((cap) => (
                  <div key={cap} className="flex items-center gap-1.5 text-text-secondary">
                    <div className="w-1 h-1 rounded-full bg-[#f0c040]" />
                    {cap}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-lg transition-colors mx-auto"
              >
                <Plus className="w-4 h-4" />
                Launch Browser
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateSessionModal onClose={() => setShowCreateModal(false)} onCreate={handleCreate} />
      )}
    </motion.div>
  )
}

// Session list item component
function SessionItem({ session, selected, onSelect, onClose }: {
  session: BrowserSession
  selected: boolean
  onSelect: () => void
  onClose: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg transition-all group ${
        selected
          ? 'bg-[#f0c040]/10 border border-[#f0c040]/30'
          : 'hover:bg-surface-light border border-transparent'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm truncate flex items-center gap-1.5">
          {(session as unknown as Record<string, string>).agentName && (
            <Bot className="w-3 h-3 text-[#f0c040] flex-shrink-0" />
          )}
          {session.name}
        </span>
        <div className="flex items-center gap-1">
          {session.status === 'active' ? (
            <Wifi className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-text-secondary flex-shrink-0" />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onClose() }}
            className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
      <p className="text-xs text-text-secondary truncate font-mono">{session.url}</p>
      <div className="flex items-center gap-2 mt-2">
        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${statusColor(session.status)}`}>
          {session.status}
        </span>
        <span className="text-xs text-text-secondary">
          {session.viewport.width}\u00d7{session.viewport.height}
        </span>
        {(session as unknown as Record<string, string>).agentName && (
          <span className="text-[10px] text-[#f0c040]/60 ml-auto">
            {(session as unknown as Record<string, string>).agentName}
          </span>
        )}
      </div>
    </button>
  )
}

// Click action form
function ClickAction({ onSubmit }: { onSubmit: (selector: string) => void }) {
  const [selector, setSelector] = useState('')
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={selector}
        onChange={(e) => setSelector(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && selector) { onSubmit(selector); setSelector('') } }}
        placeholder="#login-button, .submit-form, a[href='/admin']"
        className="flex-1 bg-surface-light border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#f0c040]"
      />
      <button
        onClick={() => { if (selector) { onSubmit(selector); setSelector('') } }}
        disabled={!selector}
        className="px-3 py-2 bg-[#f0c040]/10 border border-[#f0c040]/30 text-[#f0c040] rounded-lg hover:bg-[#f0c040]/20 disabled:opacity-30 text-xs"
      >
        Click
      </button>
    </div>
  )
}

function CreateSessionModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (data: { name: string; url: string; width: number; height: number; agentId?: string }) => void
}) {
  const [name, setName] = useState('Session 1')
  const [url, setUrl] = useState('https://')
  const [width, setWidth] = useState(1280)
  const [height, setHeight] = useState(720)

  const presets = [
    { label: 'Desktop HD', width: 1920, height: 1080 },
    { label: 'Desktop', width: 1280, height: 720 },
    { label: 'Tablet', width: 768, height: 1024 },
    { label: 'Mobile', width: 375, height: 812 },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-surface rounded-xl border border-border w-full max-w-md">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#f0c040]" />
            Launch Browser
          </h2>
          <p className="text-text-secondary text-sm">Create a CDP browser session — local Chrome, no API keys</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Session Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-[#f0c040]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Start URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 font-mono text-sm focus:outline-none focus:border-[#f0c040]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Viewport</label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => { setWidth(p.width); setHeight(p.height) }}
                  className={`p-2 text-xs rounded-lg border transition-colors text-center ${
                    width === p.width && height === p.height
                      ? 'border-[#f0c040] bg-[#f0c040]/10 text-[#f0c040]'
                      : 'border-border hover:border-[#f0c040]/30'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="flex-1 bg-surface-light border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#f0c040]"
                placeholder="Width"
              />
              <X className="w-4 h-4 text-text-secondary" />
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="flex-1 bg-surface-light border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#f0c040]"
                placeholder="Height"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 hover:bg-surface-light rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onCreate({ name, url, width, height })}
            disabled={!name || !url}
            className="px-4 py-2 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 disabled:opacity-50 rounded-lg transition-colors"
          >
            Launch
          </button>
        </div>
      </div>
    </div>
  )
}

export default BrowserManager
