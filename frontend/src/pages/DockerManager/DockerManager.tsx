import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Play,
  Pause,
  Square,
  Trash2,
  Terminal,
  Container,
  Activity,
  HardDrive,
  Cpu,
  Network,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useDockerStore } from '@/store/dockerStore'
import { dockerApi } from '@/api/docker'
import type { DockerContainer, PortMapping } from '@/types'
import toast from 'react-hot-toast'
import React from 'react'

const PENTEST_IMAGES = [
  { name: 'vxcontrol/kali-linux', desc: 'Full Kali Linux pentest suite' },
  { name: 'debian:latest', desc: 'Minimal Debian base' },
  { name: 'ubuntu:22.04', desc: 'Ubuntu 22.04 LTS' },
  { name: 'parrotsec/core', desc: 'Parrot OS security tools' },
]

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function statusColor(status: DockerContainer['status']) {
  switch (status) {
    case 'running': return 'bg-green-500/10 text-green-400 border-green-500/20'
    case 'paused': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
    case 'exited': return 'bg-red-500/10 text-red-400 border-red-500/20'
    default: return 'bg-surface-light text-text-secondary border-border'
  }
}

function DockerManager() {
  const { containers, images, logs, selectedContainer, setSelectedContainer, addContainer, removeContainer, updateContainer, setContainers, setImages, connectionStatus, isConnected, setConnectionStatus } =
    useDockerStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'containers' | 'images'>('containers')
  const [search, setSearch] = useState('')
  const [showLogs, setShowLogs] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Load containers on mount
  useEffect(() => {
    loadContainers()
  }, [])

  const loadContainers = async () => {
    setIsLoading(true)
    try {
      const containers = await dockerApi.getContainers()
      setContainers(containers)
      setConnectionStatus('connected')
    } catch (error: any) {
      console.error('Docker API error:', error)
      // Check if it's a "not_configured" response from backend
      if (error.response?.data?.reason === 'not_configured') {
        setConnectionStatus('not_configured')
        toast.error('Docker is not configured. Please mount the Docker socket.')
      } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        setConnectionStatus('disconnected')
        toast.error('Cannot connect to backend API.')
      } else {
        setConnectionStatus('error')
        toast.error('Failed to connect to Docker.')
      }
    }
    try {
      const imageData = await dockerApi.getImages()
      setImages(imageData)
    } catch (error) {
      console.log('Docker images API not available')
    } finally {
      setIsLoading(false)
    }
  }

  const filtered = (containers || []).filter(
    (c: DockerContainer) => (c.name?.toLowerCase() || '').includes(search.toLowerCase()) || (c.image?.toLowerCase() || '').includes(search.toLowerCase())
  )

  const handleCreate = async (data: { name: string; image: string; command: string; env: string }) => {
    if (!isConnected) {
      toast.error('Docker is not connected. Cannot create containers.')
      return
    }
    setIsLoading(true)
    try {
      const envVars = data.env
        ? Object.fromEntries(data.env.split('\n').filter(l => l.includes('=')).map(l => l.split('=')))
        : {}

      const container = await dockerApi.createContainer({
        name: data.name,
        image: data.image,
        command: data.command || undefined,
        environment: envVars,
      })

      addContainer(container)
      setShowCreateModal(false)
      toast.success('Container created! Starting...')

      // Auto-start the container
      await dockerApi.startContainer(container.id)
      updateContainer(container.id, { status: 'running', startedAt: new Date().toISOString() })
      toast.success('Container is running!')
    } catch (error: any) {
      console.error('Failed to create container:', error)
      if (error?.response?.data?.reason === 'not_configured') {
        setConnectionStatus('not_configured')
        toast.error('Docker is not configured.')
      } else {
        toast.error('Failed to create container.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleStart = async (container: DockerContainer) => {
    if (!isConnected) {
      toast.error('Docker is not connected.')
      return
    }
    try {
      await dockerApi.startContainer(container.id)
      updateContainer(container.id, { status: 'running', startedAt: new Date().toISOString() })
      toast.success('Container started!')
    } catch (error: any) {
      console.error('Failed to start:', error)
      if (error?.response?.data?.reason === 'not_configured') {
        setConnectionStatus('not_configured')
        toast.error('Docker is not configured.')
      } else {
        toast.error('Failed to start container.')
      }
    }
  }

  const handleStop = async (container: DockerContainer) => {
    if (!isConnected) {
      toast.error('Docker is not connected.')
      return
    }
    try {
      await dockerApi.stopContainer(container.id)
      updateContainer(container.id, { status: 'exited' })
      toast.success('Container stopped!')
    } catch (error: any) {
      console.error('Failed to stop:', error)
      if (error?.response?.data?.reason === 'not_configured') {
        setConnectionStatus('not_configured')
        toast.error('Docker is not configured.')
      } else {
        toast.error('Failed to stop container.')
      }
    }
  }

  const handleRemove = async (container: DockerContainer) => {
    if (!isConnected) {
      toast.error('Docker is not connected.')
      return
    }
    try {
      await dockerApi.removeContainer(container.id, true)
      removeContainer(container.id)
      if (selectedContainer?.id === container.id) setSelectedContainer(null)
      toast.success('Container removed!')
    } catch (error: any) {
      console.error('Failed to remove:', error)
      if (error?.response?.data?.reason === 'not_configured') {
        setConnectionStatus('not_configured')
        toast.error('Docker is not configured.')
      } else {
        toast.error('Failed to remove container.')
      }
    }
  }

  const handleTerminal = (container: DockerContainer) => {
    if (!isConnected) {
      toast.error('Docker is not connected.')
      return
    }
    toast(`Opening terminal for ${container.name}...`)
    // In a real implementation, this would open a terminal connection
    // For now, we show a placeholder
    window.open(`/api/docker/containers/${container.id}/terminal`, '_blank')
  }

  const containerLogs = selectedContainer ? (logs[selectedContainer.id] || []) : []

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Docker Manager</h1>
          <p className="text-text-secondary flex items-center gap-2">
            Manage containers and images
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${
              connectionStatus === 'connected'
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : connectionStatus === 'not_configured'
                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' :
                connectionStatus === 'not_configured' ? 'bg-yellow-400' : 'bg-red-400'
              }`} />
              {connectionStatus === 'connected' ? 'Connected' :
               connectionStatus === 'not_configured' ? 'Not Configured' :
               connectionStatus === 'disconnected' ? 'Disconnected' : 'Error'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadContainers}
            disabled={isLoading}
            className="p-2 hover:bg-surface-light rounded-lg transition-colors text-text-secondary disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!isConnected || connectionStatus === 'not_configured'}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Container</span>
          </button>
        </div>
      </div>

      {/* Connection Status Banner */}
      {connectionStatus === 'not_configured' && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 p-4">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-yellow-400 text-xs">!</span>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-400">Docker Not Configured</h3>
              <p className="text-sm text-text-secondary mt-1">
                The Docker socket is not mounted. Container management requires the Docker socket to be accessible.
              </p>
              <div className="mt-2 text-xs text-text-secondary bg-surface-light rounded-lg p-3 font-mono">
                <p>To fix this in Docker Compose:</p>
                <p className="mt-1 text-yellow-400/80">volumes:</p>
                <p className="pl-2">- /var/run/docker.sock:/var/run/docker.sock</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {connectionStatus === 'error' && (
        <div className="bg-red-500/10 border-b border-red-500/20 p-4">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-red-400 text-xs">×</span>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-400">Docker Connection Error</h3>
              <p className="text-sm text-text-secondary mt-1">
                Failed to connect to the Docker daemon. Please check that Docker is running and the socket is accessible.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 p-4 border-b border-border">
        {[
          { label: 'Total', value: containers.length, icon: Container, color: 'text-white' },
          { label: 'Running', value: containers.filter(c => c.status === 'running').length, icon: Play, color: 'text-green-400' },
          { label: 'Paused', value: containers.filter(c => c.status === 'paused').length, icon: Pause, color: 'text-yellow-400' },
          { label: 'Exited', value: containers.filter(c => c.status === 'exited').length, icon: Square, color: 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="bg-surface rounded-xl border border-border p-4 flex items-center gap-3">
            <s.icon className={`w-5 h-5 ${s.color}`} />
            <div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-text-secondary">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Containers List */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs + Search */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex gap-4 border-b border-border">
              {(['containers', 'images'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2 text-sm font-medium capitalize transition-colors relative ${
                    activeTab === tab ? 'text-indigo-400' : 'text-text-secondary hover:text-white'
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400" />
                  )}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-9 pr-4 py-2 bg-surface-light border border-border rounded-lg text-sm focus:outline-none focus:border-primary w-52"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {activeTab === 'containers' ? (
              <div className="space-y-3">
                {filtered.length === 0 ? (
                  <div className="text-center py-16 text-text-secondary">
                    {connectionStatus === 'not_configured' ? (
                      <>
                        <Container className="w-12 h-12 mx-auto mb-4 opacity-40" />
                        <p className="font-medium">Docker is not configured</p>
                        <p className="text-sm mt-2 max-w-md mx-auto">
                          Container management requires the Docker socket to be mounted.
                          Configure your environment to enable container operations.
                        </p>
                      </>
                    ) : connectionStatus === 'error' || connectionStatus === 'disconnected' ? (
                      <>
                        <Container className="w-12 h-12 mx-auto mb-4 opacity-40" />
                        <p className="font-medium">Connection failed</p>
                        <p className="text-sm mt-2 max-w-md mx-auto">
                          Unable to connect to Docker. Check that the backend is running and Docker is accessible.
                        </p>
                        <button
                          onClick={loadContainers}
                          className="mt-4 px-4 py-2 bg-surface-light hover:bg-surface border border-border rounded-lg text-sm transition-colors"
                        >
                          Retry Connection
                        </button>
                      </>
                    ) : (
                      <>
                        <Container className="w-12 h-12 mx-auto mb-4 opacity-40" />
                        <p>No containers found</p>
                        {isConnected && (
                          <button
                            onClick={() => setShowCreateModal(true)}
                            className="mt-3 text-indigo-400 text-sm hover:text-indigo-300"
                          >
                            Create a container
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  filtered.map((container, i) => (
                    <motion.div
                      key={container.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`bg-surface rounded-xl border transition-all cursor-pointer ${
                        selectedContainer?.id === container.id
                          ? 'border-indigo-500/50 bg-indigo-600/5'
                          : 'border-border hover:border-primary/30'
                      }`}
                      onClick={() => setSelectedContainer(container)}
                    >
                      <div className="p-4 flex items-center gap-4">
                        <div className="p-2.5 bg-surface-light rounded-lg">
                          <Container className="w-5 h-5 text-text-secondary" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{container.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(container.status)}`}>
                              {container.status}
                            </span>
                          </div>
                          <p className="text-sm text-text-secondary truncate">{container.image}</p>
                        </div>

                        {container.cpuUsage !== undefined && (
                          <div className="hidden lg:flex items-center gap-4 text-xs text-text-secondary">
                            <span className="flex items-center gap-1">
                              <Cpu className="w-3.5 h-3.5" />
                              {container.cpuUsage.toFixed(1)}%
                            </span>
                            {container.memoryUsage !== undefined && (
                              <span className="flex items-center gap-1">
                                <Activity className="w-3.5 h-3.5" />
                                {formatBytes(container.memoryUsage)}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {container.status === 'running' ? (
                            <button
                              onClick={() => handleStop(container)}
                              disabled={!isConnected}
                              className="p-2 hover:bg-yellow-500/20 text-yellow-400 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Pause"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStart(container)}
                              disabled={!isConnected}
                              className="p-2 hover:bg-green-500/20 text-green-400 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Start"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleTerminal(container)}
                            disabled={!isConnected}
                            className="p-2 hover:bg-indigo-600/20 text-indigo-400 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Terminal"
                          >
                            <Terminal className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemove(container)}
                            disabled={!isConnected}
                            className="p-2 hover:bg-red-600/20 text-red-400 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {(container.ports || []).length > 0 && (
                        <div className="px-4 pb-3 flex gap-2 flex-wrap">
                          {(container.ports || []).map((p: PortMapping, pi: number) => (
                            <span key={pi} className="text-xs px-2 py-0.5 bg-surface-light rounded-full text-text-secondary">
                              {p.publicPort ? `${p.publicPort}:` : ''}{p.privatePort}/{p.type}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            ) : (
              /* Images tab */
              <div className="space-y-3">
                {images.length === 0 ? (
                  <div className="text-center py-16 text-text-secondary">
                    <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p>No images cached</p>
                  </div>
                ) : (
                  images.map((img, i) => (
                    <motion.div
                      key={img.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="bg-surface rounded-xl border border-border p-4 flex items-center gap-4"
                    >
                      <div className="p-2.5 bg-surface-light rounded-lg">
                        <HardDrive className="w-5 h-5 text-text-secondary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{img.name}</p>
                        <div className="flex gap-2 mt-1">
                          {img.tags.map((tag) => (
                            <span key={tag} className="text-xs px-2 py-0.5 bg-surface-light rounded-full text-text-secondary">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right text-xs text-text-secondary">
                        <p>{formatBytes(img.size)}</p>
                        <p>{new Date(img.createdAt).toLocaleDateString()}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedContainer && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 360, opacity: 1 }}
            className="border-l border-border bg-surface overflow-y-auto flex-shrink-0"
          >
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{selectedContainer.name}</h3>
                <button
                  onClick={() => setSelectedContainer(null)}
                  className="p-1 hover:bg-surface-light rounded-lg text-text-secondary"
                >
                  ×
                </button>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(selectedContainer.status)} mt-2 inline-block`}>
                {selectedContainer.status}
              </span>
            </div>

            <div className="p-4 space-y-5">
              {/* Info */}
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">Info</p>
                <div className="space-y-2 text-sm">
                  {[
                    { label: 'Image', value: selectedContainer.image },
                    { label: 'ID', value: selectedContainer.id.slice(0, 12) },
                    { label: 'Created', value: new Date(selectedContainer.createdAt).toLocaleString() },
                    selectedContainer.startedAt ? { label: 'Started', value: new Date(selectedContainer.startedAt).toLocaleString() } : null,
                  ].filter(Boolean).map((item) => (
                    <div key={item!.label} className="flex justify-between gap-2">
                      <span className="text-text-secondary">{item!.label}</span>
                      <span className="font-mono text-xs truncate max-w-[180px]">{item!.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resources */}
              {(selectedContainer.cpuUsage !== undefined || selectedContainer.memoryUsage !== undefined) && (
                <div>
                  <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">Resources</p>
                  {selectedContainer.cpuUsage !== undefined && (
                    <div className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span>CPU</span>
                        <span>{selectedContainer.cpuUsage.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-surface-light rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${Math.min(selectedContainer.cpuUsage, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {selectedContainer.memoryUsage !== undefined && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Memory</span>
                        <span>
                          {formatBytes(selectedContainer.memoryUsage)}
                          {selectedContainer.memoryLimit ? ` / ${formatBytes(selectedContainer.memoryLimit)}` : ''}
                        </span>
                      </div>
                      <div className="h-2 bg-surface-light rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{
                            width: selectedContainer.memoryLimit
                              ? `${(selectedContainer.memoryUsage / selectedContainer.memoryLimit) * 100}%`
                              : '0%',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Network */}
              {selectedContainer.networkStats && (
                <div>
                  <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">Network</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-surface-light rounded-lg p-2 text-center">
                      <p className="text-text-secondary text-xs">RX</p>
                      <p className="font-medium">{formatBytes(selectedContainer.networkStats.rxBytes)}</p>
                    </div>
                    <div className="bg-surface-light rounded-lg p-2 text-center">
                      <p className="text-text-secondary text-xs">TX</p>
                      <p className="font-medium">{formatBytes(selectedContainer.networkStats.txBytes)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Logs */}
              <div>
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="w-full flex items-center justify-between text-xs text-text-secondary uppercase tracking-wider mb-2"
                >
                  <span>Logs ({containerLogs.length})</span>
                  {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showLogs && (
                  <div className="bg-background rounded-lg p-3 font-mono text-xs h-48 overflow-y-auto space-y-1">
                    {containerLogs.length === 0 ? (
                      <p className="text-text-secondary">No logs available</p>
                    ) : (
                      containerLogs.slice(-100).map((log, i) => (
                        <div key={i} className={log.stream === 'stderr' ? 'text-red-400' : 'text-green-400'}>
                          <span className="text-text-secondary text-[10px] mr-2">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          {log.message}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={() => selectedContainer && handleTerminal(selectedContainer)}
                  disabled={!isConnected}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-sm"
                >
                  <Terminal className="w-4 h-4" />
                  Open Terminal
                </button>
                <button
                  disabled={!isConnected}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-surface-light hover:bg-surface border border-border disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-sm text-text-secondary"
                >
                  <Network className="w-4 h-4" />
                  Inspect Network
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateContainerModal onClose={() => setShowCreateModal(false)} onCreate={handleCreate} />
      )}
    </motion.div>
  )
}

function CreateContainerModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (data: { name: string; image: string; command: string; env: string }) => void
}) {
  const [name, setName] = useState('')
  const [image, setImage] = useState('debian:latest')
  const [command, setCommand] = useState('')
  const [env, setEnv] = useState('')

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-surface rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold">Create Container</h2>
          <p className="text-text-secondary">Launch a new Docker container</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Container Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., pentest-kali-01"
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Image</label>
            <input
              type="text"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="e.g., kalilinux/kali-rolling"
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary mb-2"
            />
            <div className="grid grid-cols-2 gap-2">
              {PENTEST_IMAGES.map((img) => (
                <button
                  key={img.name}
                  onClick={() => setImage(img.name)}
                  className={`text-left p-2 rounded-lg border text-xs transition-colors ${
                    image === img.name
                      ? 'border-indigo-500 bg-indigo-600/20'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="font-medium truncate">{img.name}</p>
                  <p className="text-text-secondary">{img.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Command (optional)</label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g., /bin/bash"
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Environment Variables</label>
            <textarea
              value={env}
              onChange={(e) => setEnv(e.target.value)}
              placeholder="KEY=value&#10;ANOTHER=val"
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary font-mono text-sm resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 hover:bg-surface-light rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onCreate({ name, image, command, env })}
            disabled={!name || !image}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            Create Container
          </button>
        </div>
      </div>
    </div>
  )
}

export default DockerManager
