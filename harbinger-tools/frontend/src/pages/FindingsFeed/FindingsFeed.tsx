import { useEffect, useMemo, useState, type FC } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Radio,
  RefreshCw,
  Search,
  Download,
  XCircle,
  CheckCircle,
  AlertTriangle,
  Shield,
  Bug,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Wifi,
  WifiOff,
  Filter,
  Trash2,
} from 'lucide-react'
import { useFindingsStore } from '../../store/findingsStore'
import type { Finding } from '../../api/findings'

const FONT = 'JetBrains Mono, Fira Code, monospace'

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'CRIT' },
  high:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'HIGH' },
  medium:   { color: '#f0c040', bg: 'rgba(240,192,64,0.15)', label: 'MED' },
  low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.15)', label: 'LOW' },
  info:     { color: '#00d4ff', bg: 'rgba(0,212,255,0.15)', label: 'INFO' },
}

const CONFIDENCE_LABELS: Record<string, string> = {
  confirmed: 'CONFIRMED',
  likely: 'LIKELY',
  possible: 'POSSIBLE',
  fp: 'FALSE POS',
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// ── Severity Badge ───────────────────────────────────────────────────────────

const SeverityBadge: FC<{ severity: string }> = ({ severity }) => {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info
  return (
    <span
      style={{
        fontFamily: FONT,
        fontSize: 10,
        fontWeight: 700,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}40`,
        padding: '2px 6px',
        borderRadius: 3,
        letterSpacing: '0.05em',
      }}
    >
      {cfg.label}
    </span>
  )
}

// ── Finding Row ──────────────────────────────────────────────────────────────

const FindingRow: FC<{
  finding: Finding
  isSelected: boolean
  onSelect: () => void
  onToggleFP: (id: string, fp: boolean) => void
}> = ({ finding, isSelected, onSelect, onToggleFP }) => {
  const severityCfg = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.info

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      onClick={onSelect}
      style={{
        fontFamily: FONT,
        padding: '10px 14px',
        borderBottom: '1px solid #1a1a2e',
        cursor: 'pointer',
        background: isSelected ? '#1a1a2e' : finding.falsePositive ? '#0d0d15' : 'transparent',
        opacity: finding.falsePositive ? 0.5 : 1,
        borderLeft: `3px solid ${severityCfg.color}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = '#0d0d1599'
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = finding.falsePositive ? '#0d0d15' : 'transparent'
      }}
    >
      {/* Severity */}
      <SeverityBadge severity={finding.severity} />

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {finding.title}
          </span>
          {finding.falsePositive && (
            <span style={{ fontSize: 9, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '1px 4px', borderRadius: 2, fontWeight: 700 }}>FP</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 3, fontSize: 11, color: '#9ca3af' }}>
          <span>{finding.host}{finding.port ? `:${finding.port}` : ''}</span>
          {finding.endpoint && <span style={{ color: '#555' }}>→ {finding.endpoint}</span>}
          {finding.category && <span style={{ color: '#f0c040' }}>[{finding.category}]</span>}
          {finding.agentCodename && <span style={{ color: '#00d4ff' }}>{finding.agentCodename}</span>}
        </div>
      </div>

      {/* Confidence */}
      <span style={{ fontSize: 10, color: finding.confidence === 'confirmed' ? '#22c55e' : '#9ca3af', whiteSpace: 'nowrap' }}>
        {CONFIDENCE_LABELS[finding.confidence] || finding.confidence}
      </span>

      {/* Timestamp */}
      <span style={{ fontSize: 10, color: '#555', whiteSpace: 'nowrap', width: 60, textAlign: 'right' }}>
        {timeAgo(finding.foundAt)}
      </span>

      {/* FP toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleFP(finding.id, !finding.falsePositive)
        }}
        title={finding.falsePositive ? 'Unmark false positive' : 'Mark as false positive'}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          color: finding.falsePositive ? '#ef4444' : '#555',
          transition: 'color 0.15s',
        }}
      >
        {finding.falsePositive ? <XCircle size={14} /> : <EyeOff size={14} />}
      </button>
    </motion.div>
  )
}

// ── Finding Detail Panel ─────────────────────────────────────────────────────

const FindingDetail: FC<{
  finding: Finding
  onClose: () => void
  onToggleFP: (id: string, fp: boolean) => void
  onDelete: (id: string) => void
}> = ({ finding, onClose, onToggleFP, onDelete }) => {
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(new Set())

  const toggleEvidence = (id: string) => {
    setExpandedEvidence((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      style={{
        fontFamily: FONT,
        padding: 20,
        height: '100%',
        overflowY: 'auto',
        borderLeft: '1px solid #1a1a2e',
        background: '#0d0d15',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <SeverityBadge severity={finding.severity} />
            <span style={{ fontSize: 10, color: '#555' }}>{finding.id}</span>
          </div>
          <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: 0 }}>{finding.title}</h3>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 4 }}>✕</button>
      </div>

      {/* Metadata grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 12, marginBottom: 16 }}>
        <div>
          <span style={{ color: '#555' }}>Host</span>
          <div style={{ color: '#fff' }}>{finding.host}{finding.port ? `:${finding.port}` : ''}</div>
        </div>
        <div>
          <span style={{ color: '#555' }}>Agent</span>
          <div style={{ color: '#00d4ff' }}>{finding.agentCodename || '—'}</div>
        </div>
        <div>
          <span style={{ color: '#555' }}>Category</span>
          <div style={{ color: '#f0c040' }}>{finding.category || '—'}</div>
        </div>
        <div>
          <span style={{ color: '#555' }}>Tool</span>
          <div style={{ color: '#9ca3af' }}>{finding.tool || '—'}</div>
        </div>
        <div>
          <span style={{ color: '#555' }}>Confidence</span>
          <div style={{ color: finding.confidence === 'confirmed' ? '#22c55e' : '#9ca3af' }}>
            {CONFIDENCE_LABELS[finding.confidence] || finding.confidence}
          </div>
        </div>
        <div>
          <span style={{ color: '#555' }}>Status</span>
          <div style={{ color: '#fff' }}>{finding.status}</div>
        </div>
        {finding.cveId && (
          <div>
            <span style={{ color: '#555' }}>CVE</span>
            <div style={{ color: '#ef4444' }}>{finding.cveId}</div>
          </div>
        )}
        {finding.cvss !== undefined && finding.cvss > 0 && (
          <div>
            <span style={{ color: '#555' }}>CVSS</span>
            <div style={{ color: '#f59e0b' }}>{finding.cvss.toFixed(1)}</div>
          </div>
        )}
        {finding.endpoint && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{ color: '#555' }}>Endpoint</span>
            <div style={{ color: '#9ca3af', wordBreak: 'break-all' }}>{finding.endpoint}</div>
          </div>
        )}
      </div>

      {/* Description */}
      {finding.description && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>Description</div>
          <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{finding.description}</div>
        </div>
      )}

      {/* Tool output */}
      {finding.toolOutput && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>Tool Output</div>
          <pre style={{
            fontSize: 11,
            color: '#22c55e',
            background: '#0a0a0f',
            border: '1px solid #1a1a2e',
            borderRadius: 4,
            padding: 10,
            overflow: 'auto',
            maxHeight: 200,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            margin: 0,
          }}>
            {finding.toolOutput}
          </pre>
        </div>
      )}

      {/* Evidence */}
      {finding.evidence.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>Evidence ({finding.evidence.length})</div>
          {finding.evidence.map((ev) => (
            <div key={ev.id} style={{ marginBottom: 6, border: '1px solid #1a1a2e', borderRadius: 4 }}>
              <button
                onClick={() => toggleEvidence(ev.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: FONT,
                  textAlign: 'left',
                }}
              >
                {expandedEvidence.has(ev.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span style={{ color: '#f0c040', fontSize: 10, textTransform: 'uppercase' }}>{ev.type}</span>
                <span>{ev.title}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#555' }}>{timeAgo(ev.createdAt)}</span>
              </button>
              {expandedEvidence.has(ev.id) && (
                <pre style={{
                  fontSize: 11,
                  color: '#9ca3af',
                  background: '#0a0a0f',
                  padding: 10,
                  margin: 0,
                  borderTop: '1px solid #1a1a2e',
                  overflow: 'auto',
                  maxHeight: 300,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {ev.content}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #1a1a2e' }}>
        <button
          onClick={() => onToggleFP(finding.id, !finding.falsePositive)}
          style={{
            fontFamily: FONT,
            fontSize: 11,
            padding: '6px 12px',
            borderRadius: 4,
            border: '1px solid #1a1a2e',
            background: finding.falsePositive ? 'rgba(239,68,68,0.1)' : 'transparent',
            color: finding.falsePositive ? '#ef4444' : '#9ca3af',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {finding.falsePositive ? <><Eye size={12} /> Unmark FP</> : <><EyeOff size={12} /> Mark FP</>}
        </button>
        <button
          onClick={() => onDelete(finding.id)}
          style={{
            fontFamily: FONT,
            fontSize: 11,
            padding: '6px 12px',
            borderRadius: 4,
            border: '1px solid #ef444440',
            background: 'transparent',
            color: '#ef4444',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </motion.div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

const FindingsFeed: FC = () => {
  const {
    findings,
    summary,
    selectedFinding,
    filters,
    isLoading,
    sseConnected,
    fetchFindings,
    fetchSummary,
    selectFinding,
    toggleFalsePositive,
    deleteFinding,
    setFilters,
    clearFilters,
    exportFindings,
    connectSSE,
    disconnectSSE,
  } = useFindingsStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchFindings()
    fetchSummary()
    connectSSE()
    return () => disconnectSSE()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return findings
    const q = searchQuery.toLowerCase()
    return findings.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.host.toLowerCase().includes(q) ||
        f.category?.toLowerCase().includes(q) ||
        f.agentCodename?.toLowerCase().includes(q) ||
        f.tool?.toLowerCase().includes(q) ||
        f.cveId?.toLowerCase().includes(q)
    )
  }, [findings, searchQuery])

  const handleToggleFP = (id: string, fp: boolean) => {
    toggleFalsePositive(id, fp)
  }

  return (
    <div style={{ fontFamily: FONT, height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0f' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1a1a2e',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#0d0d15',
      }}>
        <Radio size={18} style={{ color: '#f0c040' }} />
        <h1 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0, flex: 1 }}>
          FINDINGS FEED
        </h1>

        {/* SSE status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: sseConnected ? '#22c55e' : '#ef4444' }}>
          {sseConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {sseConnected ? 'LIVE' : 'OFFLINE'}
        </div>

        {/* Severity summary pills */}
        {summary && (
          <div style={{ display: 'flex', gap: 6 }}>
            {(['critical', 'high', 'medium', 'low', 'info'] as const).map((sev) => {
              const count = summary.bySeverity[sev] || 0
              if (count === 0) return null
              const cfg = SEVERITY_CONFIG[sev]
              return (
                <button
                  key={sev}
                  onClick={() => setFilters({ severity: filters.severity === sev ? undefined : sev })}
                  style={{
                    fontFamily: FONT,
                    fontSize: 10,
                    fontWeight: 700,
                    color: cfg.color,
                    background: filters.severity === sev ? cfg.bg : 'transparent',
                    border: `1px solid ${cfg.color}40`,
                    padding: '2px 8px',
                    borderRadius: 3,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {cfg.label} {count}
                </button>
              )
            })}
          </div>
        )}

        {/* Actions */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            background: showFilters ? 'rgba(240,192,64,0.1)' : 'none',
            border: '1px solid #1a1a2e',
            color: showFilters ? '#f0c040' : '#9ca3af',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontFamily: FONT,
          }}
        >
          <Filter size={12} /> Filters
        </button>

        <button
          onClick={() => exportFindings('json')}
          style={{
            background: 'none',
            border: '1px solid #1a1a2e',
            color: '#9ca3af',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontFamily: FONT,
          }}
        >
          <Download size={12} /> Export
        </button>

        <button
          onClick={() => { fetchFindings(); fetchSummary() }}
          disabled={isLoading}
          style={{
            background: 'none',
            border: '1px solid #1a1a2e',
            color: isLoading ? '#555' : '#9ca3af',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            padding: 4,
            borderRadius: 4,
            display: 'flex',
          }}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Filter bar (collapsible) ────────────────────────────────────── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{
              overflow: 'hidden',
              borderBottom: '1px solid #1a1a2e',
              background: '#0d0d15',
            }}
          >
            <div style={{ padding: '8px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Search */}
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search findings..."
                  style={{
                    fontFamily: FONT,
                    fontSize: 12,
                    padding: '5px 8px 5px 26px',
                    background: '#0a0a0f',
                    border: '1px solid #1a1a2e',
                    borderRadius: 4,
                    color: '#fff',
                    width: '100%',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Status filter */}
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ status: e.target.value || undefined })}
                style={{
                  fontFamily: FONT,
                  fontSize: 11,
                  padding: '5px 8px',
                  background: '#0a0a0f',
                  border: '1px solid #1a1a2e',
                  borderRadius: 4,
                  color: '#9ca3af',
                  outline: 'none',
                }}
              >
                <option value="">All statuses</option>
                <option value="new">New</option>
                <option value="triaged">Triaged</option>
                <option value="promoted">Promoted</option>
                <option value="dismissed">Dismissed</option>
              </select>

              {/* Hide FP toggle */}
              <button
                onClick={() => setFilters({ hideFalsePositives: !filters.hideFalsePositives })}
                style={{
                  fontFamily: FONT,
                  fontSize: 11,
                  padding: '5px 8px',
                  background: filters.hideFalsePositives ? 'rgba(239,68,68,0.1)' : 'transparent',
                  border: '1px solid #1a1a2e',
                  borderRadius: 4,
                  color: filters.hideFalsePositives ? '#ef4444' : '#9ca3af',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <EyeOff size={11} />
                {filters.hideFalsePositives ? 'Showing FP hidden' : 'Hide FP'}
              </button>

              {/* CSV export */}
              <button
                onClick={() => exportFindings('csv')}
                style={{
                  fontFamily: FONT,
                  fontSize: 11,
                  padding: '5px 8px',
                  background: 'transparent',
                  border: '1px solid #1a1a2e',
                  borderRadius: 4,
                  color: '#9ca3af',
                  cursor: 'pointer',
                }}
              >
                CSV
              </button>

              {/* Clear filters */}
              {(filters.severity || filters.status || filters.agent || filters.category || filters.hideFalsePositives) && (
                <button
                  onClick={clearFilters}
                  style={{
                    fontFamily: FONT,
                    fontSize: 11,
                    padding: '5px 8px',
                    background: 'transparent',
                    border: '1px solid #f0c04040',
                    borderRadius: 4,
                    color: '#f0c040',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content: findings list + detail panel ───────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Findings list */}
        <div style={{ flex: selectedFinding ? 1 : 1, overflowY: 'auto', minWidth: 0 }}>
          {isLoading && findings.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#555', fontSize: 13 }}>
              <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
              Loading findings...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>
              <Shield size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <div style={{ fontSize: 13, marginBottom: 4 }}>No findings yet</div>
              <div style={{ fontSize: 11 }}>Findings will appear here in real-time as agents discover them</div>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((f) => (
                <FindingRow
                  key={f.id}
                  finding={f}
                  isSelected={selectedFinding?.id === f.id}
                  onSelect={() => selectFinding(selectedFinding?.id === f.id ? null : f)}
                  onToggleFP={handleToggleFP}
                />
              ))}
            </AnimatePresence>
          )}

          {/* Footer stats */}
          {filtered.length > 0 && (
            <div style={{
              padding: '8px 14px',
              borderTop: '1px solid #1a1a2e',
              fontSize: 10,
              color: '#555',
              display: 'flex',
              gap: 16,
              background: '#0d0d15',
            }}>
              <span>{filtered.length} finding{filtered.length !== 1 ? 's' : ''}</span>
              {summary && summary.falsePositive > 0 && (
                <span>{summary.falsePositive} marked FP</span>
              )}
              {summary && Object.entries(summary.byAgent).length > 0 && (
                <span>
                  Agents: {Object.entries(summary.byAgent).map(([a, c]) => `${a}(${c})`).join(' ')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selectedFinding && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 420 }}
              exit={{ width: 0 }}
              style={{ overflow: 'hidden', flexShrink: 0 }}
            >
              <FindingDetail
                finding={selectedFinding}
                onClose={() => selectFinding(null)}
                onToggleFP={handleToggleFP}
                onDelete={(id) => { deleteFinding(id); selectFinding(null) }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default FindingsFeed
