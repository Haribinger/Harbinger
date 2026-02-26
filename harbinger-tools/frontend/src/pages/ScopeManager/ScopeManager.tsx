import { useState } from 'react'
import { Shield, ShieldOff, Search, Filter, History, Upload, Plus, Ban, Undo2, FileDown } from 'lucide-react'

interface ScopeAsset {
  id: string
  pattern: string
  type: 'Wildcard' | 'Web App' | 'CIDR' | 'API' | 'Mobile'
  tags: string[]
}

interface ExclusionAsset {
  id: string
  pattern: string
  reason: string
  tags: string[]
}

const SAMPLE_IN_SCOPE: ScopeAsset[] = [
  { id: '1', pattern: '*.falcon-api.io', type: 'Wildcard', tags: ['API', 'NodeJS'] },
  { id: '2', pattern: 'app.falcon-platform.com', type: 'Web App', tags: ['Prod'] },
  { id: '3', pattern: '10.0.4.0/24', type: 'CIDR', tags: ['Internal'] },
  { id: '4', pattern: 'checkout.falcon.com', type: 'Web App', tags: ['PCI-DSS', 'Mobile'] },
  { id: '5', pattern: '*.cdn.falcon.io', type: 'Wildcard', tags: ['CDN'] },
  { id: '6', pattern: 'auth.falcon-platform.com', type: 'Web App', tags: ['Auth', 'Critical'] },
  { id: '7', pattern: 'mobile-api.falcon.com', type: 'API', tags: ['Mobile', 'REST'] },
  { id: '8', pattern: '172.16.0.0/16', type: 'CIDR', tags: ['Internal', 'VPN'] },
]

const SAMPLE_EXCLUSIONS: ExclusionAsset[] = [
  { id: 'e1', pattern: 'dev.falcon-internal.com', reason: 'Third Party Managed', tags: ['Staging'] },
  { id: 'e2', pattern: '*.legacy.falcon.io', reason: 'Deprecated Assets', tags: ['Legacy'] },
  { id: 'e3', pattern: 'test-sandbox.falcon.com', reason: 'Non-production', tags: ['Test'] },
]

type AssetFilter = 'all' | 'cloud' | 'mobile'

export default function ScopeManager() {
  const [filter, setFilter] = useState<AssetFilter>('all')
  const [search, setSearch] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [bulkTarget, setBulkTarget] = useState<'in-scope' | 'exclusion'>('in-scope')
  const [inScope] = useState(SAMPLE_IN_SCOPE)
  const [exclusions] = useState(SAMPLE_EXCLUSIONS)

  const filteredInScope = inScope.filter((a) => {
    if (search && !a.pattern.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'cloud' && !a.tags.some((t) => ['CDN', 'Cloud', 'API'].includes(t))) return false
    if (filter === 'mobile' && !a.tags.some((t) => ['Mobile'].includes(t))) return false
    return true
  })

  const logs = [
    { time: '14:22:01', level: 'INF', msg: `Successfully parsed ${inScope.length} in-scope assets.`, color: 'text-green-400' },
    { time: '14:22:05', level: 'LOG', msg: 'Validating regex patterns for wildcard domains...', color: 'text-gray-400' },
    { time: '14:22:08', level: 'WRN', msg: 'Overlap detected between CIDR 10.0.4.0/24 and exclusion list.', color: 'text-gold-400' },
    { time: '14:22:12', level: 'LOG', msg: 'Auto-tagging applied based on subdomain structure.', color: 'text-gray-400' },
    { time: '14:22:45', level: 'SYS', msg: 'Awaiting bulk CSV upload...', color: 'text-gold-400' },
  ]

  return (
    <div className="h-full flex flex-col bg-obsidian-900 text-white overflow-hidden">
      {/* Header */}
      <header className="border-b border-gold-400/20 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-gold-400 p-1.5">
            <Shield className="w-4 h-4 text-obsidian-900" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight uppercase font-mono">Scope Manager</h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
              <span className="text-[10px] font-mono opacity-60 uppercase tracking-widest">Live Session</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 border border-gold-400/40 text-gold-400 hover:bg-gold-400/10 text-xs font-bold uppercase tracking-wider flex items-center gap-2 font-mono">
            <FileDown className="w-3.5 h-3.5" />
            Export Scope
          </button>
          <button className="px-4 py-2 bg-gold-400 text-obsidian-900 hover:bg-gold-400/90 font-bold text-xs uppercase tracking-wider flex items-center gap-2 font-mono">
            <Plus className="w-3.5 h-3.5" />
            Add to Scope
          </button>
        </div>
      </header>

      {/* Controls Bar */}
      <div className="p-4 flex items-center justify-between bg-surface-800/40 border-b border-gold-400/10">
        <div className="flex gap-4">
          <div className="flex border border-gold-400/20 overflow-hidden">
            {(['all', 'cloud', 'mobile'] as AssetFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 text-xs font-bold uppercase font-mono ${
                  filter === f ? 'bg-gold-400/20 text-gold-400' : 'opacity-60 hover:opacity-100'
                }`}
              >
                {f === 'all' ? 'All Assets' : f === 'cloud' ? 'Cloud Assets' : 'Mobile'}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gold-400/60" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-obsidian-900 border border-gold-400/20 text-xs py-1.5 pl-9 pr-4 w-64 focus:ring-1 focus:ring-gold-400 focus:border-gold-400 outline-none font-mono"
              placeholder="Search target pattern..."
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-[10px] flex items-center gap-1 opacity-60 hover:opacity-100 uppercase tracking-tighter font-mono">
            <Filter className="w-3.5 h-3.5 text-gold-400" />
            Filter By Tag
          </button>
          <button className="text-[10px] flex items-center gap-1 opacity-60 hover:opacity-100 uppercase tracking-tighter font-mono">
            <History className="w-3.5 h-3.5 text-gold-400" />
            Audit Log
          </button>
        </div>
      </div>

      {/* Main Content: Two-pane scope tables */}
      <div className="flex flex-1 min-h-0">
        {/* In-Scope */}
        <section className="flex-1 flex flex-col border-r border-gold-400/10 bg-obsidian-900/50">
          <div className="px-4 py-2 bg-gold-400/5 flex items-center justify-between border-b border-gold-400/20">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-gold-400" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-gold-400 font-mono">In-Scope Assets</h2>
              <span className="text-[10px] bg-gold-400/20 text-gold-400 px-1.5 py-0.5 font-mono">{filteredInScope.length}</span>
            </div>
            <button className="text-[10px] text-gold-400/80 hover:underline uppercase font-mono">Bulk Action</button>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-800 z-10">
                <tr className="text-[10px] uppercase font-bold text-gray-500 border-b border-gold-400/10 font-mono">
                  <th className="px-4 py-2 font-medium">Asset Pattern</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Tags</th>
                  <th className="px-4 py-2 font-medium w-10 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-400/5 font-mono text-[11px]">
                {filteredInScope.map((asset) => (
                  <tr key={asset.id} className="group hover:bg-gold-400/5">
                    <td className="px-4 py-2 text-gold-400">{asset.pattern}</td>
                    <td className="px-4 py-2 opacity-70">{asset.type}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {asset.tags.map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 border border-gold-400/20 text-[9px] uppercase bg-gold-400/5">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400">
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Out-of-Scope */}
        <section className="flex-1 flex flex-col bg-obsidian-900/30">
          <div className="px-4 py-2 bg-surface-800 flex items-center justify-between border-b border-gold-400/20">
            <div className="flex items-center gap-2">
              <ShieldOff className="w-4 h-4 text-gray-500" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 font-mono">Out-of-Scope</h2>
              <span className="text-[10px] bg-surface-800 text-gray-400 px-1.5 py-0.5 font-mono border border-gray-700">{exclusions.length}</span>
            </div>
            <button className="text-[10px] text-gray-500 hover:underline uppercase font-mono">Import Exclusion</button>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-800 z-10">
                <tr className="text-[10px] uppercase font-bold text-gray-500 border-b border-gold-400/10 font-mono">
                  <th className="px-4 py-2 font-medium">Asset Pattern</th>
                  <th className="px-4 py-2 font-medium">Reason</th>
                  <th className="px-4 py-2 font-medium">Tags</th>
                  <th className="px-4 py-2 font-medium w-10 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-400/5 font-mono text-[11px]">
                {exclusions.map((asset) => (
                  <tr key={asset.id} className="group hover:bg-gold-400/5">
                    <td className="px-4 py-2 text-gray-400">{asset.pattern}</td>
                    <td className="px-4 py-2 text-red-400/70 italic">{asset.reason}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        {asset.tags.map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 border border-gray-700 text-[9px] uppercase text-gray-500">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button className="opacity-0 group-hover:opacity-100 text-gold-400 hover:text-gold-400/80">
                        <Undo2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Bottom Panel: Console + Bulk Entry */}
      <div className="h-48 border-t border-gold-400/30 flex bg-surface-800/80">
        {/* System Validation Logs */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-gold-400/10">
          <div className="px-3 py-1 bg-surface-800 border-b border-gold-400/10 flex items-center justify-between">
            <span className="text-[9px] font-bold text-gold-400 tracking-widest uppercase font-mono">System Validation Logs</span>
            <span className="text-[9px] font-mono text-gold-400/60">SESSION_ID: 0x8F92A</span>
          </div>
          <div className="p-3 font-mono text-[10px] space-y-1 overflow-auto flex-1 bg-obsidian-900">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-gold-400/50">[{log.time}]</span>
                <span className={log.color}>{log.msg}</span>
              </div>
            ))}
            <div className="flex gap-2 animate-pulse">
              <span className="w-1.5 h-3 bg-gold-400/40 inline-block" />
            </div>
          </div>
        </div>

        {/* Quick Asset Entry */}
        <div className="w-[450px] flex flex-col">
          <div className="px-3 py-1 bg-surface-800 border-b border-gold-400/10 flex items-center gap-4">
            <span className="text-[9px] font-bold text-gold-400 tracking-widest uppercase font-mono">Quick Asset Entry</span>
            <div className="flex gap-3">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="target"
                  checked={bulkTarget === 'in-scope'}
                  onChange={() => setBulkTarget('in-scope')}
                  className="w-2.5 h-2.5 bg-obsidian-900 border-gold-400/40 text-gold-400 focus:ring-0"
                />
                <span className="text-[8px] uppercase font-bold text-gold-400/80 font-mono">In-Scope</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="target"
                  checked={bulkTarget === 'exclusion'}
                  onChange={() => setBulkTarget('exclusion')}
                  className="w-2.5 h-2.5 bg-obsidian-900 border-gold-400/40 text-gold-400 focus:ring-0"
                />
                <span className="text-[8px] uppercase font-bold text-gray-500 font-mono">Exclusion</span>
              </label>
            </div>
          </div>
          <div className="flex-1 p-2 relative">
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full h-full bg-obsidian-900 border border-gold-400/20 text-[10px] font-mono p-2 focus:ring-1 focus:ring-gold-400 focus:border-gold-400 outline-none resize-none placeholder:text-gray-600"
              placeholder={'Paste assets here (one per line)...\n*.example.com\n192.168.1.0/24'}
            />
            <div className="absolute bottom-4 right-4 flex gap-2">
              <button className="bg-surface-800 border border-gold-400/20 text-gray-300 px-3 py-1 text-[9px] font-bold uppercase hover:bg-surface-800/80 flex items-center gap-1 font-mono">
                <Upload className="w-3 h-3" />
                CSV/TXT
              </button>
              <button className="bg-gold-400 text-obsidian-900 px-3 py-1 text-[9px] font-bold uppercase hover:brightness-110 font-mono">
                Process List
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <footer className="bg-surface-800 border-t border-gold-400/20 px-4 py-1.5 flex items-center justify-between text-[10px] tracking-widest font-mono text-gold-400/40">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            API CONNECTED
          </span>
          <span>SYNC: 200 OK</span>
          <span>LATENCY: 14ms</span>
        </div>
        <span className="text-gold-400/60 font-bold">Compliance Level: High</span>
      </footer>
    </div>
  )
}
