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
  const [activeTab, setActiveTab] = useState<'console' | 'network' | 'screenshot'>('console')
  const [urlInput, setUrlInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      const data = await browserApi.getSessions()
      setSessions(data)
    } catch (error) {
      console.log('Browser API not available, using local sessions')
    }
  }

  const handleCreate = async (data: { name: string; url: string; width: number; height: number }) => {
    setIsLoading(true)
    try {
      // Try to create real browser session via API
      const session = await browserApi.createSession({
        url: data.url,
        headless: false,
        viewport: { width: data.width, height: data.height },
      })

      // Add name since API might not return it
      const sessionWithName = { ...session, name: data.name }
      addSession(sessionWithName)
      setShowCreateModal(false)
      setSelectedSession(sessionWithName)
      toast.success('Browser session launched!')
    } catch (error) {
      console.error('Failed to create browser session:', error)
      // Fallback to local session if API fails
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
      toast.success('Local browser session created (API unavailable)')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCloseSession = async (id: string) => {
    try {
      await browserApi.closeSession(id)
      removeSession(id)
      toast.success('Session closed')
    } catch (error) {
      console.error('Failed to close session:', error)
      removeSession(id)
    }
  }

  const handleTakeScreenshot = async () => {
    if (!selectedSession) return
    try {
      const { data } = await browserApi.takeScreenshot(selectedSession.id)
      updateSession(selectedSession.id, { screenshot: data })
      toast.success('Screenshot captured!')
    } catch (error) {
      console.error('Failed to take screenshot:', error)
      toast.error('Failed to capture screenshot')
    }
  }

  const handleNavigate = async (url: string) => {
    if (!selectedSession || !url) return
    try {
      await browserApi.navigate(selectedSession.id, url)
      updateSession(selectedSession.id, { url })
      toast.success('Navigated to ' + url)
    } catch (error) {
      console.error('Failed to navigate:', error)
      toast.error('Failed to navigate')
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex overflow-hidden"
    >
      {/* Session List */}
      <div className="w-64 border-r border-border flex flex-col bg-surface">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Browser Sessions</h2>
            <p className="text-xs text-text-secondary">{sessions.length} sessions</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 bg-[#f0c040]/10 border border-[#f0c040]/30 text-[#f0c040] hover:bg-[#f0c040]/20 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-text-secondary px-4">
              <Globe className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No browser sessions</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-3 text-[#f0c040] text-sm hover:text-[#f0c040]/80"
              >
                Launch a browser
              </button>
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  selectedSession?.id === session.id
                    ? 'bg-[#f0c040]/10 border border-[#f0c040]/30'
                    : 'hover:bg-surface-light border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm truncate">{session.name}</span>
                  {session.status === 'active' ? (
                    <Wifi className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5 text-text-secondary flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-text-secondary truncate">{session.url}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full border ${statusColor(session.status)}`}>
                    {session.status}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {session.viewport.width}×{session.viewport.height}
                  </span>
                </div>
              </button>
            ))
          )}
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
              <button className="p-2 hover:bg-surface-light rounded-lg text-text-secondary transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button className="p-2 hover:bg-surface-light rounded-lg text-text-secondary transition-colors">
                <Home className="w-4 h-4" />
              </button>

              <div className="flex-1 relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type="text"
                  value={urlInput || selectedSession.url}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && urlInput) {
                      updateSession(selectedSession.id, { url: urlInput })
                      setUrlInput('')
                    }
                  }}
                  placeholder="https://"
                  className="w-full bg-surface-light border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <button
                onClick={() => removeSession(selectedSession.id)}
                className="p-2 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Viewport Preview */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Browser viewport placeholder */}
              <div className="flex-1 bg-white relative overflow-hidden" style={{ minHeight: '200px', maxHeight: '40%' }}>
                {selectedSession.screenshot ? (
                  <img src={selectedSession.screenshot} alt="Browser preview" className="w-full h-full object-contain" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                    <div className="text-center text-gray-400">
                      <Globe className="w-16 h-16 mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-medium">{selectedSession.url}</p>
                      <p className="text-xs mt-1 opacity-60">Live browser view — connect via MCP</p>
                    </div>
                  </div>
                )}

                <button
                  className="absolute bottom-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-colors"
                  title="Take screenshot"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              {/* DevTools Panel */}
              <div className="flex-1 border-t border-border flex flex-col overflow-hidden">
                {/* Tabs */}
                <div className="flex items-center border-b border-border px-4 gap-4">
                  {(['console', 'network', 'screenshot'] as const).map((tab) => (
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
                                  <span className={statusCodeColor(req.status)}>{req.status || '—'}</span>
                                </td>
                                <td className="px-4 py-1.5 max-w-xs">
                                  <span className="truncate block text-text-secondary">{req.url}</span>
                                </td>
                                <td className="px-4 py-1.5 text-text-secondary">
                                  {req.size ? `${(req.size / 1024).toFixed(1)}kb` : '—'}
                                </td>
                                <td className="px-4 py-1.5 text-text-secondary">
                                  {req.time ? `${req.time}ms` : '—'}
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
                        <img
                          src={selectedSession.screenshot}
                          alt="Screenshot"
                          className="max-w-full rounded-lg border border-border"
                        />
                      ) : (
                        <div className="text-center py-10 text-text-secondary">
                          <Camera className="w-10 h-10 mx-auto mb-3 opacity-40" />
                          <p>No screenshot taken yet</p>
                          <p className="text-xs mt-1">Use the camera button to capture the viewport</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-secondary">
            <div className="text-center">
              <Globe className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Select a browser session</p>
              <p className="text-sm mt-1">or launch a new browser to get started</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-lg transition-colors mx-auto"
              >
                <Plus className="w-4 h-4" />
                Launch Browser
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateSessionModal onClose={() => setShowCreateModal(false)} onCreate={handleCreate} />
      )}
    </motion.div>
  )
}

function CreateSessionModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (data: { name: string; url: string; width: number; height: number }) => void
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
          <h2 className="text-xl font-bold">Launch Browser</h2>
          <p className="text-text-secondary">Create a new browser session</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Session Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Start URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
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
                      ? 'border-[#f0c040] bg-[#f0c040]/10'
                      : 'border-border hover:border-primary/50'
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
                className="flex-1 bg-surface-light border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                placeholder="Width"
              />
              <X className="w-4 h-4 text-text-secondary" />
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="flex-1 bg-surface-light border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
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
            Launch Browser
          </button>
        </div>
      </div>
    </div>
  )
}

export default BrowserManager
