import { useState, useEffect, useCallback } from 'react'
import { Upload, Terminal, ExternalLink, AlertTriangle, Image, FileText, Copy, Loader2 } from 'lucide-react'
import { vulnsApi, type Vulnerability, type VulnEvidence } from '../../api/vulns'

type EvidenceType = 'POST' | '200' | 'IMG' | 'LOG'

interface EvidenceItem {
  id: string
  type: EvidenceType
  label: string
  timestamp: string
  detail: string
  badges?: string[]
}

interface TriageStep {
  step: number
  label: string
  detail: string
  active: boolean
  completed: boolean
}

function evidenceToItems(evidence: VulnEvidence[]): EvidenceItem[] {
  return evidence.map((e) => {
    const typeMap: Record<string, EvidenceType> = { request: 'POST', response: '200', screenshot: 'IMG', log: 'LOG', poc: 'POST', code: 'LOG' }
    return {
      id: e.id,
      type: typeMap[e.type] || 'LOG',
      label: e.title,
      timestamp: new Date(e.createdAt).toLocaleTimeString('en-US', { hour12: false }),
      detail: e.type.toUpperCase(),
      badges: e.type === 'poc' ? ['POC'] : undefined,
    }
  })
}

function vulnToTriageSteps(vuln: Vulnerability | null): TriageStep[] {
  if (!vuln) return [
    { step: 1, label: 'DISCOVERED', detail: '', active: false, completed: false },
    { step: 2, label: 'IN TRIAGE', detail: '', active: false, completed: false },
    { step: 3, label: 'REMEDIATED', detail: '', active: false, completed: false },
  ]
  const statusOrder = ['new', 'triaged', 'in_progress', 'remediated', 'verified']
  const idx = statusOrder.indexOf(vuln.status)
  return [
    { step: 1, label: 'DISCOVERED', detail: vuln.foundAt ? new Date(vuln.foundAt).toLocaleString() : '', active: idx === 0, completed: idx > 0 },
    { step: 2, label: 'IN TRIAGE', detail: vuln.agentName ? `Agent: ${vuln.agentName}` : '', active: idx === 1 || idx === 2, completed: idx > 2 },
    { step: 3, label: 'REMEDIATED', detail: vuln.slaDeadline ? `SLA: ${new Date(vuln.slaDeadline).toLocaleDateString()}` : '', active: idx >= 3, completed: idx >= 4 },
  ]
}

const CODE_LINES_EMPTY = [
  { num: '01', text: '# No vulnerability selected', color: 'text-gray-500' },
  { num: '02', text: '# Select a finding from the vulnerability list', color: 'text-gray-500' },
  { num: '03', text: '# or create a new one from the agents.', color: 'text-gray-500' },
]

function getEvidenceColor(type: EvidenceType) {
  switch (type) {
    case 'POST': return { border: 'border-gold-400', bg: 'bg-gold-400/5', badge: 'bg-gold-400 text-black' }
    case '200': return { border: 'border-gray-500', bg: 'bg-gray-500/5', badge: 'bg-gray-500 text-black' }
    case 'IMG': return { border: 'border-blue-400', bg: 'bg-blue-400/5', badge: 'bg-blue-400 text-black' }
    case 'LOG': return { border: 'border-red-400', bg: 'bg-red-400/5', badge: 'bg-red-400 text-black' }
  }
}

function getEvidenceIcon(type: EvidenceType) {
  switch (type) {
    case 'POST': return <Terminal className="w-3 h-3" />
    case '200': return <FileText className="w-3 h-3" />
    case 'IMG': return <Image className="w-3 h-3" />
    case 'LOG': return <AlertTriangle className="w-3 h-3" />
  }
}

export default function VulnDeepDive() {
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write')
  const [summary, setSummary] = useState('')
  const [vulns, setVulns] = useState<Vulnerability[]>([])
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchVulns = useCallback(async () => {
    try {
      const res = await vulnsApi.list()
      setVulns(res.vulns || [])
      if (res.vulns?.length > 0 && !selectedVuln) {
        setSelectedVuln(res.vulns[0])
      }
    } catch { /* backend not available */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchVulns() }, [fetchVulns])

  const EVIDENCE = selectedVuln ? evidenceToItems(selectedVuln.evidence || []) : []
  const TRIAGE_STEPS = vulnToTriageSteps(selectedVuln)
  const CODE_LINES = selectedVuln?.description
    ? selectedVuln.description.split('\n').map((line, i) => ({
        num: String(i + 1).padStart(2, '0'),
        text: line,
        color: line.includes('ERROR') || line.includes('Exception') ? 'text-red-400' : 'text-gray-400',
      }))
    : CODE_LINES_EMPTY

  const handleUpdateStatus = async (status: string) => {
    if (!selectedVuln) return
    try {
      const res = await vulnsApi.update(selectedVuln.id, { status: status as Vulnerability['status'] })
      if (res.ok) {
        setSelectedVuln(res.vuln)
        fetchVulns()
      }
    } catch { /* handled */ }
  }

  const handleAddEvidence = async () => {
    if (!selectedVuln) return
    try {
      await vulnsApi.addEvidence(selectedVuln.id, {
        type: 'log',
        title: `Evidence ${(selectedVuln.evidence?.length || 0) + 1}`,
        content: summary || 'Manual evidence entry',
      })
      fetchVulns()
      // Refresh selected vuln
      const res = await vulnsApi.get(selectedVuln.id)
      if (res.ok) setSelectedVuln(res.vuln)
    } catch { /* handled */ }
  }

  return (
    <div className="h-full flex flex-col bg-obsidian-900 text-white overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-gold-400/30 flex items-center justify-between px-6 bg-obsidian-900">
        <div className="flex items-center gap-4">
          <div className="bg-gold-400 text-obsidian-900 font-bold px-2 py-1 text-xs tracking-tighter font-mono">V-SYSTEM</div>
          <div className="flex items-center gap-2 text-sm font-mono">
            <span className="opacity-50">BOUNTY</span>
            <span className="opacity-50">/</span>
            <span className="opacity-50">FINDINGS</span>
            <span className="opacity-50">/</span>
            <span className="text-gold-400">[P1-7742]</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-50 font-mono">SCAN_ID:</span>
            <span className="text-xs font-mono">0x7F22A1</span>
          </div>
        </div>
      </header>

      {/* Main Three-Pane Layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Evidence Vault */}
        <aside className="w-72 border-r border-gold-400/20 flex flex-col bg-[#0d0e12] overflow-hidden">
          <div className="p-4 border-b border-gold-400/20 bg-gold-400/5 flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-widest uppercase text-gold-400 font-mono">Evidence Vault</h2>
            <span className="text-[10px] font-mono opacity-50">{EVIDENCE.length} ITEMS</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {EVIDENCE.map((item) => {
              const colors = getEvidenceColor(item.type)
              return (
                <div
                  key={item.id}
                  className={`group cursor-pointer border-l-2 ${colors.border} ${colors.bg} p-3 hover:brightness-125 transition-all`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`${colors.badge} text-[10px] px-1.5 font-bold flex items-center gap-1`}>
                      {getEvidenceIcon(item.type)}
                      {item.detail}
                    </span>
                    <span className="text-[10px] font-mono opacity-40 italic">{item.timestamp}</span>
                  </div>
                  <p className="text-[11px] font-mono truncate">{item.label}</p>
                  {item.badges && (
                    <div className="mt-2 flex gap-2">
                      {item.badges.map((b) => (
                        <span key={b} className="text-[9px] border border-gold-400/30 px-1 opacity-60 font-mono">{b}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="p-4 border-t border-gold-400/20">
            <button onClick={handleAddEvidence} disabled={!selectedVuln} className="w-full border border-gold-400/50 text-gold-400 py-2 text-xs font-bold hover:bg-gold-400 hover:text-black transition-all font-mono flex items-center justify-center gap-2 disabled:opacity-30">
              <Upload className="w-3.5 h-3.5" />
              {selectedVuln ? 'ADD EVIDENCE' : 'NO VULN SELECTED'}
            </button>
          </div>
        </aside>

        {/* Center: Technical Analysis */}
        <section className="flex-1 flex flex-col bg-obsidian-900 overflow-y-auto">
          {/* Severity Banner */}
          <div className={`${selectedVuln?.severity === 'critical' ? 'bg-red-600' : selectedVuln?.severity === 'high' ? 'bg-orange-600' : selectedVuln?.severity === 'medium' ? 'bg-yellow-600' : 'bg-blue-600'} text-white p-6 flex justify-between items-center relative overflow-hidden`}>
            <div className="absolute right-0 top-0 text-[120px] font-black opacity-10 select-none -mr-10 -mt-10 tracking-tighter leading-none">
              {(selectedVuln?.severity || 'N/A').toUpperCase()}
            </div>
            <div className="z-10">
              <h1 className="text-4xl font-black tracking-tighter leading-none mb-1 font-mono">{selectedVuln?.cvss || '—'} {(selectedVuln?.severity || 'N/A').toUpperCase()}</h1>
              <p className="text-xs uppercase font-mono tracking-widest opacity-80">
                {selectedVuln?.title || 'No vulnerability selected — create findings via agents'}
              </p>
            </div>
            <div className="z-10 text-right">
              <span className="block text-xs font-mono mb-1 opacity-80">PRIORITY</span>
              <span className="text-2xl font-black bg-white text-red-600 px-4 py-1">P1</span>
            </div>
          </div>

          <div className="p-6 space-y-8 max-w-5xl mx-auto w-full">
            {/* Title & Target */}
            <div className="border-b border-gold-400/20 pb-4">
              <h2 className="text-2xl font-bold tracking-tight text-gold-400">Blind SQL Injection via Search Endpoint</h2>
              <p className="font-mono text-sm mt-2 opacity-60">TARGET: https://prod-api-internal.v-platform.io/api/v1/user/search</p>
            </div>

            {/* Code Terminal */}
            <div className="bg-[#0c0d0e] border-2 border-gold-400/40 relative">
              <div className="flex items-center justify-between px-4 py-2 bg-gold-400/10 border-b border-gold-400/40">
                <span className="text-[10px] font-mono uppercase tracking-widest text-gold-400">Terminal Analysis - RAW_PAYLOAD</span>
                <button className="opacity-60 hover:opacity-100">
                  <Copy className="w-3.5 h-3.5 text-gold-400" />
                </button>
              </div>
              <div className="p-4 font-mono text-sm overflow-x-auto leading-relaxed">
                {CODE_LINES.map((line) => (
                  <div key={line.num} className="flex gap-4">
                    <span className="opacity-20 select-none w-6 text-right">{line.num}</span>
                    <span className={line.color}>{line.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Markdown Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gold-400 font-mono">Executive Summary</h3>
                <div className="flex bg-gold-400/5 border border-gold-400/20">
                  <button
                    onClick={() => setEditorTab('write')}
                    className={`px-3 py-1 text-[10px] font-bold font-mono ${editorTab === 'write' ? 'bg-gold-400 text-black' : 'hover:bg-gold-400/20'}`}
                  >
                    WRITE
                  </button>
                  <button
                    onClick={() => setEditorTab('preview')}
                    className={`px-3 py-1 text-[10px] font-bold font-mono ${editorTab === 'preview' ? 'bg-gold-400 text-black' : 'hover:bg-gold-400/20'}`}
                  >
                    PREVIEW
                  </button>
                </div>
              </div>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full h-48 bg-transparent border border-gold-400/20 p-4 font-mono text-sm focus:ring-1 focus:ring-gold-400 focus:border-gold-400 placeholder:opacity-20"
                placeholder={"## IMPACT ANALYSIS\nThe vulnerability allows an unauthenticated attacker to bypass authentication and dump the entire 'users' table..."}
              />
            </div>
          </div>
        </section>

        {/* Right: Triage & Control */}
        <aside className="w-80 border-l border-gold-400/20 bg-[#0d0e12] flex flex-col">
          <div className="p-4 border-b border-gold-400/20 bg-gold-400/5">
            <h2 className="text-xs font-bold tracking-widest uppercase text-gold-400 font-mono">Triage & Control</h2>
          </div>
          <div className="p-6 flex-1 space-y-8 overflow-y-auto">
            {/* Status Stepper */}
            <div className="relative pl-6 space-y-8 before:content-[''] before:absolute before:left-[1px] before:top-2 before:bottom-2 before:w-[1px] before:bg-gold-400/20">
              {TRIAGE_STEPS.map((step) => (
                <div key={step.step} className={`relative ${!step.active && !step.completed ? 'opacity-30' : ''}`}>
                  <div
                    className={`absolute -left-[25px] top-1 w-3 h-3 ${
                      step.active
                        ? 'bg-gold-400 shadow-[4px_4px_0px_0px_#f0c040]'
                        : step.completed
                        ? 'bg-gold-400/30 border border-gold-400/50'
                        : 'border border-white/20'
                    }`}
                  />
                  <h4 className={`text-[10px] font-bold mb-1 font-mono ${step.active ? 'text-gold-400 tracking-widest' : 'opacity-40'}`}>
                    STEP {String(step.step).padStart(2, '0')}
                  </h4>
                  <p className={`text-xs font-bold ${step.active ? 'text-gold-400 underline underline-offset-4' : ''}`}>
                    {step.label}
                  </p>
                  {step.detail && (
                    <p className="text-[10px] opacity-40 font-mono italic">{step.detail}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Action Toolbar */}
            <div className="space-y-4 pt-4 border-t border-gold-400/10">
              <button className="w-full bg-gold-400 text-black font-bold py-3 text-sm tracking-tight flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_#f0c040] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all font-mono">
                <Terminal className="w-4 h-4" />
                GENERATE PYTHON PoC
              </button>

              <div className="space-y-3 pt-4">
                <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest font-mono">Platform Sync</p>
                <button className="w-full border border-gold-400/40 text-[11px] font-bold py-2 text-left px-4 hover:bg-gold-400/10 flex items-center justify-between group font-mono">
                  EXPORT TO HACKERONE
                  <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />
                </button>
                <button className="w-full border border-gold-400/40 text-[11px] font-bold py-2 text-left px-4 hover:bg-gold-400/10 flex items-center justify-between group font-mono">
                  EXPORT TO BUGCROWD
                  <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />
                </button>
              </div>
            </div>

            {/* Remediation Snippet */}
            <div className="bg-white/5 p-4 border border-white/10">
              <h4 className="text-[10px] font-bold mb-2 opacity-60 font-mono">REMEDIATION QUICK-FIX</h4>
              <p className="text-[11px] leading-relaxed opacity-80">
                Use <span className="text-gold-400">PreparedStatement</span> or{' '}
                <span className="text-gold-400">ORM parameterized queries</span> to prevent injection.
                Ensure input validation on the <code className="font-mono">query</code> parameter.
              </p>
            </div>
          </div>

          {/* Footer Stats */}
          <div className="p-4 border-t border-gold-400/20 bg-gold-400/5">
            <div className="flex justify-between text-[10px] font-mono opacity-50 mb-1">
              <span>DB_HITS: 42</span>
              <span>LATENCY: 142ms</span>
            </div>
            <div className="w-full bg-gold-400/10 h-1">
              <div className="bg-gold-400 h-full w-3/4" />
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
