import { useState } from 'react'
import { Shield, Terminal, FileText, Mail, CheckCircle, ExternalLink, Copy, Zap } from 'lucide-react'

type Priority = 'P1' | 'P2' | 'P3'
type VulnStatus = 'new' | 'triaged' | 'fix-pending' | 'resolved'

interface VulnCard {
  id: string
  priority: Priority
  title: string
  cveId: string
  assignee: string
  status: VulnStatus
  active?: boolean
}

const VULN_PIPELINE: VulnCard[] = [
  { id: 'RC-8812', priority: 'P1', title: 'Pre-auth RCE via Serialized Object Injection', cveId: 'CVE-2023-4812', assignee: 'dev_alpha', status: 'new' },
  { id: 'RC-8790', priority: 'P2', title: 'SQLi via Filter Parameter on /api/v2/search', cveId: 'CVE-2023-4551', assignee: 's_mccall', status: 'triaged' },
  { id: 'RC-8701', priority: 'P1', title: 'Log4Shell Persistence in Legacy Gateway', cveId: 'CVE-2021-44228', assignee: 'engineering_lead', status: 'fix-pending', active: true },
  { id: 'RC-8550', priority: 'P3', title: 'CORS Misconfiguration on Stage', cveId: 'CVE-2023-1102', assignee: '', status: 'resolved' },
]

const COLUMNS: { status: VulnStatus; label: string; num: string }[] = [
  { status: 'new', label: 'New / Inbound', num: '01' },
  { status: 'triaged', label: 'Triaged', num: '02' },
  { status: 'fix-pending', label: 'Fix Pending', num: '03' },
  { status: 'resolved', label: 'Resolved', num: '04' },
]

function priorityColor(p: Priority) {
  switch (p) {
    case 'P1': return 'bg-red-600'
    case 'P2': return 'bg-orange-600'
    case 'P3': return 'bg-gray-600'
  }
}

function priorityLabel(p: Priority) {
  switch (p) {
    case 'P1': return 'P1 CRITICAL'
    case 'P2': return 'P2 HIGH'
    case 'P3': return 'P3 MED'
  }
}

const CONSOLE_LINES = [
  { time: '14:22:01', level: 'INFO', msg: 'Initializing Nuclei Engine v3.1.2...', color: '' },
  { time: '14:22:02', level: 'INFO', msg: 'Loading template: cves/2021/CVE-2021-44228.yaml', color: '', link: true },
  { time: '14:22:03', level: 'SCAN', msg: 'Testing target: https://gateway-prod-01.redclaw.io', color: '' },
  { time: '14:22:05', level: 'RE-SCAN', msg: 'Testing CVE-2021-44228...', color: 'font-bold' },
  { time: '14:22:07', level: 'FIXED', msg: 'Target no longer vulnerable to JNDI injection.', color: 'text-green-400 font-black' },
]

export default function RemediationTracker() {
  const [selectedVuln] = useState(VULN_PIPELINE.find((v) => v.active) || VULN_PIPELINE[0])
  const [consoleInput, setConsoleInput] = useState('')

  return (
    <div className="h-full flex flex-col bg-obsidian-900 text-white overflow-hidden">
      {/* Header */}
      <header className="border-b border-gold-400/30 h-14 flex items-center justify-between px-6 bg-obsidian-900">
        <div className="flex items-center gap-4">
          <div className="w-6 h-6 bg-gold-400 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-obsidian-900" />
          </div>
          <h1 className="text-xl font-bold tracking-tighter uppercase text-gold-400 font-mono">RedClaw</h1>
          <div className="h-4 w-px bg-gold-400/20 mx-2" />
          <span className="text-xs font-medium tracking-widest text-gold-400/60 uppercase font-mono">Remediation Dashboard</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase opacity-60 font-mono">System Online</span>
          </div>
        </div>
      </header>

      {/* Main Three-Pane */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Vulnerability Pipeline */}
        <aside className="w-[30%] border-r border-gold-400/20 flex flex-col bg-[#0d0e12]">
          <div className="p-4 border-b border-gold-400/10 flex justify-between items-center bg-gold-400/5">
            <h2 className="text-xs font-black uppercase tracking-widest text-gold-400 font-mono">Vulnerability Pipeline</h2>
            <span className="text-[10px] font-mono bg-gold-400/20 px-2 py-0.5 border border-gold-400/30">
              {VULN_PIPELINE.filter((v) => v.status !== 'resolved').length} Active
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {COLUMNS.map((col) => {
              const cards = VULN_PIPELINE.filter((v) => v.status === col.status)
              return (
                <section key={col.status}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-tighter text-gold-400/40 font-mono">{col.num}</span>
                    <h3 className="text-[11px] font-bold uppercase tracking-widest font-mono">{col.label}</h3>
                  </div>
                  <div className="space-y-2">
                    {cards.map((vuln) => (
                      <div
                        key={vuln.id}
                        className={`p-3 cursor-pointer group transition-colors ${
                          vuln.active
                            ? 'border-2 border-gold-400 bg-gold-400/10 shadow-[4px_4px_0px_0px_#f0c040]'
                            : vuln.status === 'resolved'
                            ? 'border border-white/10 opacity-40 grayscale'
                            : vuln.status === 'new'
                            ? 'border border-gold-400/30 bg-gold-400/5 hover:border-gold-400'
                            : 'border border-gold-400/10 bg-black/20 hover:border-gold-400/40'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-[10px] ${priorityColor(vuln.priority)} text-white px-2 py-0.5 font-bold uppercase`}>
                            {priorityLabel(vuln.priority)}
                          </span>
                          {vuln.active ? (
                            <Zap className="w-3.5 h-3.5 text-gold-400" />
                          ) : (
                            <span className="text-[10px] font-mono text-gold-400 opacity-60">#{vuln.id}</span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold leading-tight mb-2 group-hover:text-gold-400 transition-colors">
                          {vuln.title}
                        </h4>
                        <div className="flex items-center justify-between text-[10px] font-mono opacity-60">
                          <span className={vuln.active ? 'text-gold-400' : ''}>{vuln.cveId}</span>
                          {vuln.assignee && <span>{vuln.assignee}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </aside>

        {/* Center: Remediation Details */}
        <section className="w-[50%] flex flex-col overflow-hidden">
          {/* SLA Header */}
          <div className="p-6 border-b border-gold-400/20 bg-obsidian-900">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h2 className="text-3xl font-black uppercase italic tracking-tighter font-mono" style={{ textShadow: '0 0 5px rgba(240,192,64,0.4)' }}>
                  {selectedVuln.cveId}
                </h2>
                <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-gold-400/60 font-mono">
                  {selectedVuln.title} — SLA Track
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-mono font-black text-red-500">08:42:12</div>
                <div className="text-[10px] uppercase font-bold opacity-50 tracking-widest font-mono">Remaining to Deadline</div>
              </div>
            </div>

            {/* SLA Progress Bar */}
            <div className="h-8 w-full border border-gold-400/30 flex p-1 relative overflow-hidden">
              <div className="h-full bg-gold-400 w-[75%] relative">
                <div className="absolute inset-0 opacity-30" style={{
                  background: 'linear-gradient(to bottom, rgba(240,192,64,0.05) 50%, rgba(0,0,0,0.1) 50%)',
                  backgroundSize: '100% 4px',
                }} />
              </div>
              <div className="h-full flex-1 border-l border-gold-400/20 flex items-center justify-center">
                <span className="text-[10px] font-black uppercase text-gold-400/40 font-mono">Critical Warning Area</span>
              </div>
            </div>
            <div className="flex justify-between mt-2 font-mono text-[9px] uppercase tracking-widest opacity-60">
              <span>Inbound: 2023-10-12</span>
              <span>Deadline: 2023-10-14</span>
            </div>
          </div>

          {/* Fix Guidance */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="w-4 h-4 text-gold-400" />
              <h3 className="text-xs font-black uppercase tracking-widest font-mono">Recommended Fix Guidance</h3>
            </div>
            <div className="bg-black border-l-2 border-gold-400 p-4 mb-6">
              <p className="text-sm font-medium mb-4 leading-relaxed text-gray-300">
                Update all instances of Log4j to version 2.17.1 or higher. If immediate patching is not possible,
                apply the following configuration mitigations to disable message lookup.
              </p>
              <div className="relative group">
                <button className="absolute top-2 right-2 bg-gold-400/20 hover:bg-gold-400/40 p-1 border border-gold-400/30">
                  <Copy className="w-3.5 h-3.5 text-gold-400" />
                </button>
                <pre className="bg-[#050505] p-4 text-[13px] font-mono text-gold-400/80 leading-relaxed overflow-x-auto border border-gold-400/10">
{`# Update nginx.conf to mitigate header injection
location / {
    proxy_pass http://backend_app;
    proxy_set_header X-Api-Version $http_x_api_version;
    # Mitigation: Strip JNDI lookup patterns from headers
    if ($http_user_agent ~* "jndi") {
        return 403;
    }
}

# Add JVM parameter to disable lookups
# -Dlog4j2.formatMsgNoLookups=true`}
                </pre>
              </div>
            </div>

            {/* Affected Systems + Required Permissions */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-gold-400/20 p-4">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-50 block mb-2 font-mono">Affected Systems</span>
                <ul className="text-xs font-mono space-y-1">
                  <li>- app-gateway-01.prod</li>
                  <li>- legacy-auth-service</li>
                  <li>- logging-collector-04</li>
                </ul>
              </div>
              <div className="border border-gold-400/20 p-4">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-50 block mb-2 font-mono">Required Permissions</span>
                <ul className="text-xs font-mono space-y-1">
                  <li>- K8s Cluster Admin</li>
                  <li>- Root on Nginx Ingress</li>
                  <li>- CI/CD Secret Access</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Verification Console */}
          <div className="h-48 border-t border-gold-400/30 bg-black flex flex-col">
            <div className="flex items-center justify-between px-4 py-1.5 bg-gold-400/10 border-b border-gold-400/20">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-gold-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gold-400 font-mono">Live Verification Console</span>
              </div>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500/50" />
                <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                <div className="w-2 h-2 rounded-full bg-green-500/50" />
              </div>
            </div>
            <div className="flex-1 p-4 font-mono text-[11px] overflow-y-auto text-gold-400/80 space-y-1">
              {CONSOLE_LINES.map((line, i) => (
                <div key={i} className={`flex gap-2 ${line.color}`}>
                  <span className="opacity-30">{line.time}</span>
                  <span>[{line.level}]</span>
                  {line.link ? (
                    <span>{line.msg.split(':')[0]}: <span className="text-gold-400 underline">{line.msg.split(': ')[1]}</span></span>
                  ) : (
                    <span>{line.msg}</span>
                  )}
                </div>
              ))}
              <div className="flex gap-2 animate-pulse mt-2">
                <span className="text-gold-400 font-bold">_</span>
              </div>
            </div>
            <div className="p-2 bg-gold-400/5 flex gap-2 items-center">
              <span className="text-gold-400 font-bold ml-2 text-xs font-mono">&gt;</span>
              <input
                type="text"
                value={consoleInput}
                onChange={(e) => setConsoleInput(e.target.value)}
                className="bg-transparent border-none text-xs font-mono w-full focus:ring-0 text-gold-400 placeholder:text-gold-400/20 uppercase tracking-widest"
                placeholder="Trigger verification command..."
              />
              <button className="bg-gold-400 text-obsidian-900 text-[10px] font-black px-4 py-1 uppercase hover:bg-white transition-colors font-mono">
                Run Scan
              </button>
            </div>
          </div>
        </section>

        {/* Right: Bounty Status */}
        <aside className="w-[20%] border-l border-gold-400/20 flex flex-col bg-[#0d0e12]">
          <div className="p-4 border-b border-gold-400/10 bg-gold-400/5">
            <h2 className="text-xs font-black uppercase tracking-widest text-gold-400 font-mono">Bounty Status</h2>
          </div>
          <div className="p-4 space-y-6 flex-1 overflow-y-auto">
            {/* Expected Reward */}
            <div className="border border-gold-400/10 p-4">
              <span className="text-[9px] uppercase font-bold opacity-50 block mb-1 font-mono">Expected Reward</span>
              <div className="text-3xl font-black text-gold-400 tracking-tighter font-mono">
                $12,500<span className="text-xs opacity-40 ml-1">USD</span>
              </div>
            </div>

            {/* Payment Status */}
            <div className="border border-gold-400/10 p-4">
              <span className="text-[9px] uppercase font-bold opacity-50 block mb-2 font-mono">Payment Status</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider font-mono">In Escrow</span>
              </div>
              <div className="mt-2 h-1 bg-gold-400/10 w-full overflow-hidden">
                <div className="h-full bg-gold-400 w-[40%]" />
              </div>
            </div>

            {/* Platform */}
            <div className="border border-gold-400/10 p-4">
              <span className="text-[9px] uppercase font-bold opacity-50 block mb-2 font-mono">Platform</span>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase font-mono">HackerOne</span>
                <ExternalLink className="w-3.5 h-3.5 text-gold-400 hover:scale-110 transition-transform cursor-pointer" />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <button className="w-full bg-gold-400/10 border border-gold-400/40 py-3 flex items-center justify-center gap-2 hover:bg-gold-400/20 transition-colors group">
                <FileText className="w-3.5 h-3.5 text-gold-400 group-hover:rotate-12 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] font-mono">Generate Report</span>
              </button>
              <button className="w-full bg-gold-400/10 border border-gold-400/40 py-3 flex items-center justify-center gap-2 hover:bg-gold-400/20 transition-colors group">
                <Mail className="w-3.5 h-3.5 text-gold-400 group-hover:rotate-12 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] font-mono">Contact Program</span>
              </button>
              <button className="w-full bg-gold-400 border border-gold-400 py-3 flex items-center justify-center gap-2 hover:bg-white hover:border-white transition-colors group">
                <CheckCircle className="w-3.5 h-3.5 text-obsidian-900" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-obsidian-900 font-mono">Mark as Resolved</span>
              </button>
            </div>

            {/* Program Metadata */}
            <div className="pt-6 border-t border-gold-400/10">
              <div className="text-[9px] uppercase font-bold opacity-30 mb-4 tracking-[0.3em] font-mono">Program Context</div>
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="opacity-50">Discovery Date:</span>
                  <span>2023-10-10</span>
                </div>
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="opacity-50">Last Update:</span>
                  <span>14M AGO</span>
                </div>
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="opacity-50">Reporter Rank:</span>
                  <span className="text-gold-400 font-bold">TOP 1%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Network Latency */}
          <div className="mt-auto p-4 bg-black border-t border-gold-400/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-3 bg-gold-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-gold-400/80 font-mono">Network Latency</span>
            </div>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-lg font-bold">12</span>
              <span className="text-[9px] opacity-40">MS</span>
            </div>
          </div>
        </aside>
      </main>

      {/* Status Bar */}
      <footer className="h-6 bg-gold-400 text-obsidian-900 flex items-center justify-between px-4 text-[9px] font-black uppercase tracking-[0.2em] font-mono">
        <div className="flex gap-4">
          <span>DC: US-EAST-1</span>
          <span>LOAD: 0.24 0.11 0.08</span>
        </div>
        <div className="flex gap-4">
          <span className="animate-pulse">SESSION ENCRYPTED (AES-256)</span>
          <span>v2.4.0-STABLE</span>
        </div>
      </footer>
    </div>
  )
}
