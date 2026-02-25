import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Play,
  Pause,
  Trash2,
  Workflow,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap,
  Bot,
  Container,
  Globe,
  Terminal,
} from 'lucide-react'
import { useWorkflowStore } from '../../store/workflowStore'
import type { Workflow as WorkflowType } from '../../types'

const nodeTypes = [
  { type: 'agent', label: 'Agent Task', icon: Bot, color: 'from-[#f0c040] to-amber-400' },
  { type: 'docker', label: 'Docker Exec', icon: Container, color: 'from-green-500 to-emerald-500' },
  { type: 'browser', label: 'Browser Action', icon: Globe, color: 'from-purple-500 to-pink-500' },
  { type: 'script', label: 'Script', icon: Terminal, color: 'from-orange-500 to-red-500' },
  { type: 'trigger', label: 'Trigger', icon: Zap, color: 'from-yellow-500 to-amber-500' },
]

function statusIcon(status: WorkflowType['status']) {
  switch (status) {
    case 'running': return <Play className="w-4 h-4 text-blue-400" />
    case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />
    case 'error': return <XCircle className="w-4 h-4 text-red-400" />
    case 'paused': return <Pause className="w-4 h-4 text-yellow-400" />
    default: return <AlertCircle className="w-4 h-4 text-text-secondary" />
  }
}

function statusColor(status: WorkflowType['status']) {
  switch (status) {
    case 'running': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    case 'completed': return 'bg-green-500/10 text-green-400 border-green-500/20'
    case 'error': return 'bg-red-500/10 text-red-400 border-red-500/20'
    case 'paused': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
    default: return 'bg-surface-light text-text-secondary border-border'
  }
}

function Workflows() {
  const { workflows, selectedWorkflow, setSelectedWorkflow, addWorkflow, removeWorkflow, updateWorkflow } =
    useWorkflowStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'canvas'>('list')

  const handleCreate = (data: Partial<WorkflowType>) => {
    const wf: WorkflowType = {
      id: Date.now().toString(),
      name: data.name || 'New Workflow',
      description: data.description || '',
      nodes: [],
      edges: [],
      status: 'draft',
      config: {
        autoStart: false,
        retryOnError: true,
        maxRetries: 3,
        timeout: 3600,
        parallelExecution: false,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    addWorkflow(wf)
    setShowCreateModal(false)
  }

  const handleToggleRun = (wf: WorkflowType) => {
    const next = wf.status === 'running' ? 'paused' : 'running'
    updateWorkflow(wf.id, { status: next })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex overflow-hidden"
    >
      {/* Sidebar: workflow list */}
      <div className="w-72 border-r border-border flex flex-col bg-surface">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Workflows</h2>
            <p className="text-xs text-text-secondary">{workflows.length} total</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 bg-[#f0c040]/10 border border-[#f0c040]/30 text-[#f0c040] hover:bg-[#f0c040]/20 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {workflows.length === 0 ? (
            <div className="text-center py-12 text-text-secondary px-4">
              <Workflow className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No workflows yet</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-3 text-[#f0c040] text-sm hover:text-[#f0c040]/80"
              >
                Create your first workflow
              </button>
            </div>
          ) : (
            workflows.map((wf) => (
              <button
                key={wf.id}
                onClick={() => setSelectedWorkflow(wf)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  selectedWorkflow?.id === wf.id
                    ? 'bg-[#f0c040]/10 border border-[#f0c040]/30'
                    : 'hover:bg-surface-light border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm truncate">{wf.name}</span>
                  {statusIcon(wf.status)}
                </div>
                <p className="text-xs text-text-secondary truncate">{wf.description || 'No description'}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(wf.status)}`}>
                    {wf.status}
                  </span>
                  <span className="text-xs text-text-secondary flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" />
                    {wf.nodes.length} nodes
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedWorkflow ? (
          <>
            {/* Toolbar */}
            <div className="h-14 border-b border-border flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold">{selectedWorkflow.name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(selectedWorkflow.status)}`}>
                  {selectedWorkflow.status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex rounded-lg overflow-hidden border border-border">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      viewMode === 'list' ? 'bg-[#f0c040] text-[#0a0a0f]' : 'hover:bg-surface-light text-text-secondary'
                    }`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setViewMode('canvas')}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      viewMode === 'canvas' ? 'bg-[#f0c040] text-[#0a0a0f]' : 'hover:bg-surface-light text-text-secondary'
                    }`}
                  >
                    Canvas
                  </button>
                </div>

                <button
                  onClick={() => handleToggleRun(selectedWorkflow)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                    selectedWorkflow.status === 'running'
                      ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                      : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  }`}
                >
                  {selectedWorkflow.status === 'running' ? (
                    <><Pause className="w-4 h-4" /> Pause</>
                  ) : (
                    <><Play className="w-4 h-4" /> Run</>
                  )}
                </button>

                <button
                  onClick={() => { removeWorkflow(selectedWorkflow.id); setSelectedWorkflow(null) }}
                  className="p-2 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            {viewMode === 'list' ? (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Config */}
                  <div className="bg-surface rounded-xl border border-border p-5">
                    <h3 className="font-semibold mb-4">Configuration</h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Auto Start', value: selectedWorkflow.config.autoStart ? 'Yes' : 'No' },
                        { label: 'Retry on Error', value: selectedWorkflow.config.retryOnError ? 'Yes' : 'No' },
                        { label: 'Max Retries', value: selectedWorkflow.config.maxRetries },
                        { label: 'Timeout', value: `${selectedWorkflow.config.timeout}s` },
                        { label: 'Parallel Execution', value: selectedWorkflow.config.parallelExecution ? 'Yes' : 'No' },
                      ].map((item) => (
                        <div key={item.label} className="flex justify-between items-center">
                          <span className="text-sm text-text-secondary">{item.label}</span>
                          <span className="text-sm font-medium">{String(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="bg-surface rounded-xl border border-border p-5">
                    <h3 className="font-semibold mb-4">Statistics</h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Total Nodes', value: selectedWorkflow.nodes.length },
                        { label: 'Connections', value: selectedWorkflow.edges.length },
                        { label: 'Created', value: new Date(selectedWorkflow.createdAt).toLocaleDateString() },
                        { label: 'Last Updated', value: new Date(selectedWorkflow.updatedAt).toLocaleDateString() },
                      ].map((item) => (
                        <div key={item.label} className="flex justify-between items-center">
                          <span className="text-sm text-text-secondary">{item.label}</span>
                          <span className="text-sm font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Nodes */}
                <div className="bg-surface rounded-xl border border-border p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Nodes</h3>
                    <div className="flex gap-2">
                      {nodeTypes.map((nt) => (
                        <button
                          key={nt.type}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-surface-light hover:bg-surface border border-border rounded-lg transition-colors"
                        >
                          <nt.icon className="w-3.5 h-3.5" />
                          {nt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedWorkflow.nodes.length === 0 ? (
                    <div className="text-center py-10 text-text-secondary">
                      <Workflow className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">No nodes yet</p>
                      <p className="text-xs mt-1">Add nodes using the buttons above</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedWorkflow.nodes.map((node, i) => (
                        <div
                          key={node.id}
                          className="flex items-center gap-4 p-3 bg-surface-light rounded-lg border border-border"
                        >
                          <span className="text-xs text-text-secondary w-6">{i + 1}</span>
                          <span className="font-medium text-sm">{node.type}</span>
                          <span className="text-xs text-text-secondary flex-1">{JSON.stringify(node.data)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Canvas view placeholder */
              <div className="flex-1 relative bg-[radial-gradient(circle_at_1px_1px,rgba(240,192,64,0.1)_1px,transparent_0)] [background-size:32px_32px] flex items-center justify-center">
                <div className="text-center text-text-secondary">
                  <Workflow className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Visual Canvas</p>
                  <p className="text-sm mt-1">Drag and drop nodes to build your workflow</p>
                  <p className="text-xs mt-2 opacity-60">Full canvas editor coming soon</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-secondary">
            <div className="text-center">
              <Workflow className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Select a workflow</p>
              <p className="text-sm mt-1">or create a new one to get started</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-lg transition-colors mx-auto"
              >
                <Plus className="w-4 h-4" />
                Create Workflow
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateWorkflowModal onClose={() => setShowCreateModal(false)} onCreate={handleCreate} />
      )}
    </motion.div>
  )
}

function CreateWorkflowModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (data: Partial<WorkflowType>) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [autoStart, setAutoStart] = useState(false)
  const [parallelExecution, setParallelExecution] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-surface rounded-xl border border-border w-full max-w-lg">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold">Create Workflow</h2>
          <p className="text-text-secondary">Define a new automation workflow</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Bug Bounty Recon"
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this workflow does..."
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary resize-none"
              rows={3}
            />
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoStart}
                onChange={(e) => setAutoStart(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Auto Start</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={parallelExecution}
                onChange={(e) => setParallelExecution(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Parallel Execution</span>
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 hover:bg-surface-light rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onCreate({ name, description, config: { autoStart, parallelExecution, retryOnError: true, maxRetries: 3, timeout: 3600 } })}
            disabled={!name}
            className="px-4 py-2 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 disabled:opacity-50 rounded-lg transition-colors"
          >
            Create Workflow
          </button>
        </div>
      </div>
    </div>
  )
}

export default Workflows
