import { useEffect, useState } from 'react'
import { useSkillsStore, type Skill, type SkillCategory } from '../../store/skillsStore'

// Agent accent colors — matches the design system
const AGENT_COLOR: Record<string, string> = {
  PATHFINDER: '#3b82f6',
  BREACH:     '#ef4444',
  PHANTOM:    '#8b5cf6',
  SPECTER:    '#f59e0b',
  CIPHER:     '#10b981',
  SCRIBE:     '#6b7280',
}

const agentColor = (agent: string) => AGENT_COLOR[agent] ?? '#9ca3af'

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'all',               label: 'ALL' },
  { id: 'recon',             label: 'RECON' },
  { id: 'web',               label: 'WEB' },
  { id: 'cloud',             label: 'CLOUD' },
  { id: 'osint',             label: 'OSINT' },
  { id: 'binary-re',         label: 'BINARY-RE' },
  { id: 'network',           label: 'NETWORK' },
  { id: 'mobile',            label: 'MOBILE' },
  { id: 'fuzzing',           label: 'FUZZING' },
  { id: 'crypto',            label: 'CRYPTO' },
  { id: 'social-engineering',label: 'SE' },
  { id: 'bugbounty',         label: 'BOUNTY' },
]

export default function SkillsHub() {
  const {
    skills,
    selectedSkill,
    activeCategory,
    searchQuery,
    isLoading,
    error,
    setSelectedSkill,
    setActiveCategory,
    setSearchQuery,
    toggleSkill,
    fetchSkills,
    filteredSkills,
  } = useSkillsStore()

  const [detailTab, setDetailTab] = useState<'refs' | 'scripts'>('refs')
  const visible = filteredSkills()
  const enabledCount = skills.filter((s) => s.enabled).length
  const agentCount = new Set(skills.map((s) => s.agent)).size

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  return (
    <div className="h-full flex flex-col bg-background font-mono text-sm">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-lg font-bold text-white tracking-widest uppercase">SKILLS HUB</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            {skills.length} skills · {enabledCount} enabled · {agentCount} agents
          </p>
        </div>
        <input
          type="text"
          placeholder="search skills..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-56 px-3 py-1.5 bg-surface border border-border rounded text-sm text-white placeholder:text-text-secondary focus:outline-none focus:border-[#f0c040] transition-colors"
        />
      </div>

      {/* ── Error banner ───────────────────────────────────────────────────── */}
      {error && (
        <div className="px-6 py-2 bg-yellow-900/20 border-b border-yellow-700/40 text-yellow-400 text-xs">
          ⚠ {error}
        </div>
      )}

      {/* ── Category filter ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-6 py-3 border-b border-border overflow-x-auto scrollbar-thin">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1 text-xs rounded border transition-all whitespace-nowrap ${
              activeCategory === cat.id
                ? 'border-[#f0c040] text-[#f0c040] bg-[#f0c040]/10'
                : 'border-border text-text-secondary hover:border-white/40 hover:text-white'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Main split panel ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Left: skill list */}
        <div className="w-72 flex-shrink-0 border-r border-border overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-text-secondary text-xs">
              loading skills...
            </div>
          ) : visible.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-text-secondary text-xs">
              no skills match
            </div>
          ) : (
            <div className="divide-y divide-border">
              {visible.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  selected={selectedSkill?.id === skill.id}
                  onSelect={() => { setSelectedSkill(skill); setDetailTab('refs') }}
                  onToggle={() => toggleSkill(skill.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedSkill ? (
            <SkillDetail
              skill={selectedSkill}
              tab={detailTab}
              setTab={setDetailTab}
              onToggle={() => toggleSkill(selectedSkill.id)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-text-secondary">
              <div className="text-4xl mb-3 opacity-30">⚡</div>
              <p className="text-xs tracking-widest uppercase">Select a skill to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Skill list card ──────────────────────────────────────────────────────────
function SkillCard({
  skill, selected, onSelect, onToggle,
}: {
  skill: Skill
  selected: boolean
  onSelect: () => void
  onToggle: (e: React.MouseEvent) => void
}) {
  const color = agentColor(skill.agent)
  return (
    <div
      onClick={onSelect}
      className={`px-4 py-3 cursor-pointer transition-all hover:bg-surface-light ${
        selected ? 'bg-surface-light' : ''
      }`}
      style={{ borderLeft: selected ? `2px solid #f0c040` : '2px solid transparent' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: skill.enabled ? color : '#374151' }}
          />
          <span className={`font-bold uppercase tracking-wider text-xs truncate ${selected ? 'text-[#f0c040]' : 'text-white'}`}>
            {skill.name}
          </span>
        </div>
        {/* toggle button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(e) }}
          className={`text-[10px] px-1.5 py-0.5 rounded border transition-all ${
            skill.enabled
              ? 'border-green-700 text-green-400 hover:border-red-600 hover:text-red-400'
              : 'border-border text-text-secondary hover:border-green-700 hover:text-green-400'
          }`}
        >
          {skill.enabled ? 'ON' : 'OFF'}
        </button>
      </div>
      <div className="mt-1 flex items-center gap-3 text-[10px] text-text-secondary">
        <span style={{ color }}>▸ {skill.agent}</span>
        {skill.references.length > 0 && <span>{skill.references.length} refs</span>}
        {skill.scripts.length > 0 && <span>{skill.scripts.length} scripts</span>}
      </div>
    </div>
  )
}

// ── Skill detail panel ────────────────────────────────────────────────────────
function SkillDetail({
  skill, tab, setTab, onToggle,
}: {
  skill: Skill
  tab: 'refs' | 'scripts'
  setTab: (t: 'refs' | 'scripts') => void
  onToggle: () => void
}) {
  const color = agentColor(skill.agent)

  return (
    <div className="p-6">
      {/* header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold uppercase tracking-widest text-white">{skill.name}</h2>
            <span
              className="text-xs px-2 py-0.5 rounded border font-bold uppercase"
              style={{ borderColor: color, color }}
            >
              {skill.agent}
            </span>
            <span className="text-xs px-2 py-0.5 rounded border border-border text-text-secondary uppercase">
              {skill.category}
            </span>
          </div>
          <p className="text-text-secondary text-xs mt-1">{skill.agentDir}</p>
        </div>

        <button
          onClick={onToggle}
          className={`px-4 py-1.5 text-xs font-bold rounded border transition-all ${
            skill.enabled
              ? 'border-green-600 text-green-400 bg-green-900/20 hover:bg-red-900/20 hover:border-red-600 hover:text-red-400'
              : 'border-border text-text-secondary hover:border-green-600 hover:text-green-400 hover:bg-green-900/20'
          }`}
        >
          {skill.enabled ? '● ENABLED' : '○ DISABLED'}
        </button>
      </div>

      {/* description */}
      <div className="p-4 bg-surface rounded border border-border mb-5 text-xs text-text-secondary leading-relaxed">
        {skill.description}
      </div>

      {/* tabs */}
      <div className="flex gap-1 mb-4">
        {(['refs', 'scripts'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs uppercase tracking-wider rounded border transition-all ${
              tab === t
                ? 'border-[#f0c040] text-[#f0c040] bg-[#f0c040]/10'
                : 'border-border text-text-secondary hover:text-white'
            }`}
          >
            {t === 'refs' ? `References (${skill.references.length})` : `Scripts (${skill.scripts.length})`}
          </button>
        ))}
      </div>

      {/* tab content */}
      {tab === 'refs' ? (
        <div className="space-y-2">
          {skill.references.length === 0 ? (
            <p className="text-text-secondary text-xs">No reference files.</p>
          ) : (
            skill.references.map((ref) => (
              <div
                key={ref.name}
                className="flex items-center gap-3 px-4 py-2.5 bg-surface rounded border border-border hover:border-white/20 transition-all"
              >
                <span className="text-text-secondary">📄</span>
                <div className="min-w-0">
                  <p className="text-white text-xs truncate">{ref.name}</p>
                  <p className="text-text-secondary text-[10px] truncate">{ref.path}</p>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {skill.scripts.length === 0 ? (
            <p className="text-text-secondary text-xs">No script files.</p>
          ) : (
            skill.scripts.map((script) => (
              <div
                key={script}
                className="flex items-center justify-between px-4 py-2.5 bg-surface rounded border border-border hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[#f0c040]">▶</span>
                  <div>
                    <p className="text-white text-xs">{script}</p>
                    <p className="text-text-secondary text-[10px]">skills/{skill.id}/scripts/{script}</p>
                  </div>
                </div>
                <span className="text-[10px] text-text-secondary border border-border px-2 py-0.5 rounded">bash</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
