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
  FileText,
  Search,
  Shield,
  Target,
} from 'lucide-react'
import { useWorkflowStore } from '../../store/workflowStore'
import type { Workflow as WorkflowType, WorkflowNode, WorkflowEdge } from '../../types'

const nodeTypes = [
  { type: 'agent', label: 'Agent Task', icon: Bot, color: 'from-[#f0c040] to-amber-400' },
  { type: 'docker', label: 'Docker Exec', icon: Container, color: 'from-green-500 to-emerald-500' },
  { type: 'browser', label: 'Browser Action', icon: Globe, color: 'from-purple-500 to-pink-500' },
  { type: 'script', label: 'Script', icon: Terminal, color: 'from-orange-500 to-red-500' },
  { type: 'trigger', label: 'Trigger', icon: Zap, color: 'from-yellow-500 to-amber-500' },
]

// Pre-built workflow templates with real node definitions
interface WorkflowTemplate {
  id: string
  name: string
  description: string
  icon: typeof Search
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  config: WorkflowType['config']
}

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'recon-pipeline',
    name: 'Recon Pipeline',
    description: 'Full reconnaissance: subdomain enum, port scan, HTTP probing, screenshot capture',
    icon: Search,
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 200 }, data: { label: 'Target Input', trigger: 'manual', input: 'domain' } },
      { id: 'n2', type: 'agent', position: { x: 300, y: 100 }, data: { label: 'Subdomain Enum', agent: 'pathfinder', tool: 'subfinder', args: '-d ${domain} -silent' } },
      { id: 'n3', type: 'agent', position: { x: 300, y: 300 }, data: { label: 'DNS Resolve', agent: 'pathfinder', tool: 'dnsx', args: '-l ${subdomains} -resp -a' } },
      { id: 'n4', type: 'agent', position: { x: 550, y: 100 }, data: { label: 'Port Scan', agent: 'pathfinder', tool: 'naabu', args: '-l ${live_hosts} -top-ports 1000' } },
      { id: 'n5', type: 'agent', position: { x: 550, y: 300 }, data: { label: 'HTTP Probe', agent: 'pathfinder', tool: 'httpx', args: '-l ${live_hosts} -sc -td -title' } },
      { id: 'n6', type: 'agent', position: { x: 800, y: 200 }, data: { label: 'Screenshot', agent: 'lens', tool: 'screenshot', args: '-urls ${http_alive}' } },
      { id: 'n7', type: 'agent', position: { x: 1050, y: 200 }, data: { label: 'Generate Report', agent: 'scribe', tool: 'markdown-report', args: '--template recon' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n1', target: 'n3', animated: true },
      { id: 'e3', source: 'n2', target: 'n4' },
      { id: 'e4', source: 'n3', target: 'n5' },
      { id: 'e5', source: 'n4', target: 'n6' },
      { id: 'e6', source: 'n5', target: 'n6' },
      { id: 'e7', source: 'n6', target: 'n7' },
    ],
    config: { autoStart: false, retryOnError: true, maxRetries: 2, timeout: 7200, parallelExecution: true },
  },
  {
    id: 'vuln-scan',
    name: 'Vulnerability Scanner',
    description: 'Nuclei templates + custom checks against discovered endpoints',
    icon: Shield,
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 200 }, data: { label: 'URL List Input', trigger: 'manual', input: 'urls_file' } },
      { id: 'n2', type: 'agent', position: { x: 300, y: 100 }, data: { label: 'Nuclei Scan', agent: 'breach', tool: 'nuclei', args: '-l ${urls_file} -severity critical,high,medium -o findings.json -jsonl' } },
      { id: 'n3', type: 'agent', position: { x: 300, y: 300 }, data: { label: 'Directory Fuzz', agent: 'breach', tool: 'ffuf', args: '-u ${base_url}/FUZZ -w /wordlists/common.txt -mc 200,301,403' } },
      { id: 'n4', type: 'agent', position: { x: 550, y: 100 }, data: { label: 'XSS Check', agent: 'breach', tool: 'dalfox', args: '-b ${urls_file} --skip-bav' } },
      { id: 'n5', type: 'agent', position: { x: 550, y: 300 }, data: { label: 'SQLi Check', agent: 'breach', tool: 'sqlmap', args: '-m ${urls_file} --batch --level 3 --risk 2' } },
      { id: 'n6', type: 'agent', position: { x: 800, y: 200 }, data: { label: 'Deduplicate Findings', agent: 'scribe', tool: 'dedup', args: '--input findings/' } },
      { id: 'n7', type: 'agent', position: { x: 1050, y: 200 }, data: { label: 'Write Report', agent: 'scribe', tool: 'markdown-report', args: '--template vuln-assessment' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n1', target: 'n3', animated: true },
      { id: 'e3', source: 'n2', target: 'n4' },
      { id: 'e4', source: 'n2', target: 'n5' },
      { id: 'e5', source: 'n3', target: 'n6' },
      { id: 'e6', source: 'n4', target: 'n6' },
      { id: 'e7', source: 'n5', target: 'n6' },
      { id: 'e8', source: 'n6', target: 'n7' },
    ],
    config: { autoStart: false, retryOnError: true, maxRetries: 3, timeout: 14400, parallelExecution: true },
  },
  {
    id: 'bug-bounty-full',
    name: 'Bug Bounty Pipeline',
    description: 'End-to-end: recon, enumerate, scan, exploit, report — full automated bounty workflow',
    icon: Target,
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 200 }, data: { label: 'Program Scope', trigger: 'manual', input: 'scope_domains' } },
      { id: 'n2', type: 'agent', position: { x: 250, y: 200 }, data: { label: 'PATHFINDER Recon', agent: 'pathfinder', tool: 'full-recon', args: '-scope ${scope_domains}' } },
      { id: 'n3', type: 'agent', position: { x: 450, y: 100 }, data: { label: 'SPECTER OSINT', agent: 'specter', tool: 'osint-gather', args: '-targets ${recon_output}' } },
      { id: 'n4', type: 'agent', position: { x: 450, y: 300 }, data: { label: 'BREACH Scan', agent: 'breach', tool: 'vuln-scan', args: '-urls ${http_alive} -severity high,critical' } },
      { id: 'n5', type: 'agent', position: { x: 650, y: 100 }, data: { label: 'PHANTOM Cloud Check', agent: 'phantom', tool: 'cloud-enum', args: '-domains ${subdomains}' } },
      { id: 'n6', type: 'agent', position: { x: 650, y: 300 }, data: { label: 'LENS Visual Verify', agent: 'lens', tool: 'screenshot-verify', args: '-findings ${vuln_findings}' } },
      { id: 'n7', type: 'agent', position: { x: 850, y: 200 }, data: { label: 'Triage & Dedupe', agent: 'scribe', tool: 'triage', args: '-all-findings ${findings_dir}' } },
      { id: 'n8', type: 'agent', position: { x: 1050, y: 200 }, data: { label: 'SCRIBE Report', agent: 'scribe', tool: 'bounty-report', args: '--platform hackerone --template professional' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n2', target: 'n4' },
      { id: 'e4', source: 'n3', target: 'n5' },
      { id: 'e5', source: 'n4', target: 'n6' },
      { id: 'e6', source: 'n5', target: 'n7' },
      { id: 'e7', source: 'n6', target: 'n7' },
      { id: 'e8', source: 'n7', target: 'n8' },
    ],
    config: { autoStart: false, retryOnError: true, maxRetries: 2, timeout: 28800, parallelExecution: true },
  },
  {
    id: 'report-gen',
    name: 'Report Generator',
    description: 'Collect findings from agents, deduplicate, score by CVSS, generate formatted report',
    icon: FileText,
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 200 }, data: { label: 'Findings Input', trigger: 'manual', input: 'findings_dir' } },
      { id: 'n2', type: 'script', position: { x: 300, y: 200 }, data: { label: 'Parse Findings', script: 'parse-findings.sh', args: '${findings_dir}' } },
      { id: 'n3', type: 'script', position: { x: 550, y: 100 }, data: { label: 'CVSS Scoring', script: 'cvss-score.py', args: '--input ${parsed_findings}' } },
      { id: 'n4', type: 'script', position: { x: 550, y: 300 }, data: { label: 'Dedup & Merge', script: 'dedup-findings.sh', args: '--input ${parsed_findings}' } },
      { id: 'n5', type: 'agent', position: { x: 800, y: 200 }, data: { label: 'SCRIBE Narrative', agent: 'scribe', tool: 'narrative-gen', args: '--findings ${scored_findings}' } },
      { id: 'n6', type: 'agent', position: { x: 1050, y: 200 }, data: { label: 'Export PDF', agent: 'scribe', tool: 'pdf-export', args: '--report ${narrative} --format professional' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n2', target: 'n4' },
      { id: 'e4', source: 'n3', target: 'n5' },
      { id: 'e5', source: 'n4', target: 'n5' },
      { id: 'e6', source: 'n5', target: 'n6' },
    ],
    config: { autoStart: false, retryOnError: false, maxRetries: 1, timeout: 3600, parallelExecution: false },
  },
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
      nodes: data.nodes || [],
      edges: data.edges || [],
      status: 'draft',
      config: data.config || {
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
              /* Visual canvas — use the full Workflow Editor */
              <div className="flex-1 relative bg-[radial-gradient(circle_at_1px_1px,rgba(240,192,64,0.1)_1px,transparent_0)] [background-size:32px_32px] flex items-center justify-center">
                <div className="text-center text-text-secondary">
                  <Workflow className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Visual Canvas</p>
                  <p className="text-sm mt-1">Drag and drop nodes to build your workflow</p>
                  <a
                    href="/workflow-editor"
                    className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-lg text-sm transition-colors"
                  >
                    Open Workflow Editor
                  </a>
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
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  const handleTemplateSelect = (tpl: WorkflowTemplate) => {
    setSelectedTemplate(tpl.id)
    setName(tpl.name)
    setDescription(tpl.description)
    setAutoStart(tpl.config.autoStart)
    setParallelExecution(tpl.config.parallelExecution)
  }

  const handleCreate = () => {
    const tpl = WORKFLOW_TEMPLATES.find((t) => t.id === selectedTemplate)
    onCreate({
      name,
      description,
      nodes: tpl?.nodes,
      edges: tpl?.edges,
      config: {
        autoStart,
        parallelExecution,
        retryOnError: tpl?.config.retryOnError ?? true,
        maxRetries: tpl?.config.maxRetries ?? 3,
        timeout: tpl?.config.timeout ?? 3600,
      },
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-surface rounded-xl border border-border w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold">Create Workflow</h2>
          <p className="text-text-secondary">Start from a template or build from scratch</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Templates */}
          <div>
            <label className="block text-sm font-medium mb-3">Start from Template</label>
            <div className="grid grid-cols-2 gap-3">
              {WORKFLOW_TEMPLATES.map((tpl) => {
                const Icon = tpl.icon
                return (
                  <button
                    key={tpl.id}
                    onClick={() => handleTemplateSelect(tpl)}
                    className={`text-left p-4 rounded-lg border transition-all ${
                      selectedTemplate === tpl.id
                        ? 'bg-[#f0c040]/10 border-[#f0c040]/40'
                        : 'bg-surface-light border-border hover:border-[#f0c040]/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4 text-[#f0c040]" />
                      <span className="font-medium text-sm">{tpl.name}</span>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">{tpl.description}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-text-secondary">
                      <span>{tpl.nodes.length} nodes</span>
                      <span className="opacity-40">|</span>
                      <span>{tpl.edges.length} connections</span>
                    </div>
                  </button>
                )
              })}
            </div>
            {selectedTemplate && (
              <button
                onClick={() => { setSelectedTemplate(null); setName(''); setDescription('') }}
                className="mt-2 text-xs text-text-secondary hover:text-white transition-colors"
              >
                Clear template selection (blank workflow)
              </button>
            )}
          </div>

          {/* Name */}
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

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this workflow does..."
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-primary resize-none"
              rows={2}
            />
          </div>

          {/* Config toggles */}
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
            onClick={handleCreate}
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
