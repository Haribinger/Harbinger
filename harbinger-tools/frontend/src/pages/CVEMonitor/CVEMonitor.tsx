import { useEffect, useMemo, useState, type FC } from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  RefreshCw,
  Search,
  AlertTriangle,
  Database,
  Crosshair,
  Bug,
} from 'lucide-react'
import { useCVEMonitorStore } from '../../store/cveMonitorStore'
import type { CVEEntry } from '../../api/cve'

const FONT = 'JetBrains Mono, Fira Code, monospace'
const MAX_VISIBLE = 100

// Entries added within the last 7 days are considered "recent"
function isRecent(dateAdded: string): boolean {
  const added = new Date(dateAdded)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  return added >= cutoff
}

function truncate(text: string, max: number): string {
  if (!text || text.length <= max) return text
  return text.slice(0, max) + '...'
}

const CVEMonitor: FC = () => {
  const {
    vulnerabilities,
    matches,
    totalInCatalog,
    catalogVersion,
    loading,
    refreshing,
    error,
    vendorFilter,
    cachedAt,
    fetchFeed,
    fetchMatches,
    refresh,
    setVendorFilter,
  } = useCVEMonitorStore()

  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchFeed()
    fetchMatches()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when vendor filter changes (debounced by user action)
  useEffect(() => {
    fetchFeed(vendorFilter || undefined)
  }, [vendorFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let items = vulnerabilities
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (v) =>
          v.cveID.toLowerCase().includes(q) ||
          v.vendorProject.toLowerCase().includes(q) ||
          v.product.toLowerCase().includes(q) ||
          v.shortDescription.toLowerCase().includes(q) ||
          v.vulnerabilityName.toLowerCase().includes(q)
      )
    }
    return items.slice(0, MAX_VISIBLE)
  }, [vulnerabilities, searchQuery])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 min-h-full flex flex-col gap-5"
      style={{ fontFamily: FONT }}
    >
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1
            className="text-xl font-bold flex items-center gap-2"
            style={{ color: '#f0c040' }}
          >
            <Shield size={20} />
            CVE MONITOR
          </h1>

          {catalogVersion && (
            <span
              className="text-[10px] px-2 py-0.5 rounded tracking-wider"
              style={{ background: '#f0c04015', color: '#f0c040', border: '1px solid #f0c04030' }}
            >
              CATALOG {catalogVersion}
            </span>
          )}

          <span
            className="text-[10px] px-2 py-0.5 rounded tracking-wider"
            style={{ background: '#0d0d15', color: '#9ca3af', border: '1px solid #1a1a2e' }}
          >
            {totalInCatalog.toLocaleString()} TOTAL
          </span>
        </div>

        <div className="flex items-center gap-3">
          {cachedAt && (
            <span className="text-[10px]" style={{ color: '#555' }}>
              cached {new Date(cachedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors"
            style={{
              background: refreshing ? '#f0c04010' : '#0d0d15',
              border: '1px solid #1a1a2e',
              color: refreshing ? '#f0c040' : '#9ca3af',
            }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'SYNCING...' : 'REFRESH'}
          </button>
        </div>
      </div>

      {/* ── Error Banner ────────────────────────────────────────────────── */}
      {error && (
        <div
          className="flex items-center gap-2 px-4 py-2 rounded text-xs"
          style={{ background: '#ef444415', border: '1px solid #ef444430', color: '#ef4444' }}
        >
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* ── Filter Row ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Database
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: '#555' }}
          />
          <input
            type="text"
            placeholder="Filter vendor..."
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded text-xs outline-none placeholder-gray-600"
            style={{
              background: '#0d0d15',
              border: '1px solid #1a1a2e',
              color: '#e5e7eb',
              fontFamily: FONT,
            }}
          />
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: '#555' }}
          />
          <input
            type="text"
            placeholder="Search CVE ID, product, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded text-xs outline-none placeholder-gray-600"
            style={{
              background: '#0d0d15',
              border: '1px solid #1a1a2e',
              color: '#e5e7eb',
              fontFamily: FONT,
            }}
          />
        </div>

        <span className="text-[10px] ml-auto" style={{ color: '#555' }}>
          {filtered.length} shown{vulnerabilities.length > MAX_VISIBLE && ` of ${vulnerabilities.length}`}
        </span>
      </div>

      {/* ── Main Content Grid ───────────────────────────────────────────── */}
      <div className="flex gap-5 flex-1 min-h-0">
        {/* ── CVE Table ─────────────────────────────────────────────────── */}
        <div
          className="flex-1 rounded-lg flex flex-col overflow-hidden"
          style={{ background: '#0d0d15', border: '1px solid #1a1a2e' }}
        >
          {/* Fixed Header */}
          <div
            className="grid gap-2 px-4 py-2.5 text-[10px] uppercase tracking-wider flex-shrink-0"
            style={{
              gridTemplateColumns: '140px 130px 1fr 90px 80px 160px',
              color: '#9ca3af',
              borderBottom: '1px solid #1a1a2e',
              background: '#0a0a0f',
            }}
          >
            <span>CVE ID</span>
            <span>VENDOR / PRODUCT</span>
            <span>DESCRIPTION</span>
            <span>DATE ADDED</span>
            <span>RANSOMWARE</span>
            <span>REQUIRED ACTION</span>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
            {loading && vulnerabilities.length === 0 ? (
              <LoadingState />
            ) : filtered.length === 0 ? (
              <EmptyState hasFilter={!!searchQuery || !!vendorFilter} />
            ) : (
              filtered.map((cve) => (
                <CVERow key={cve.cveID} cve={cve} />
              ))
            )}
          </div>
        </div>

        {/* ── Right Sidebar: Matches ────────────────────────────────────── */}
        <div
          className="w-72 rounded-lg flex flex-col flex-shrink-0 overflow-hidden"
          style={{ background: '#0d0d15', border: '1px solid #1a1a2e' }}
        >
          <div
            className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0"
            style={{ borderBottom: '1px solid #1a1a2e', background: '#0a0a0f' }}
          >
            <Crosshair size={13} style={{ color: '#ef4444' }} />
            <span
              className="text-[10px] uppercase tracking-wider font-bold"
              style={{ color: '#9ca3af' }}
            >
              SCOPE MATCHES
            </span>
            {matches.length > 0 && (
              <span
                className="ml-auto text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: '#ef444420', color: '#ef4444' }}
              >
                {matches.length}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2" style={{ maxHeight: 'calc(100vh - 320px)' }}>
            {matches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Crosshair size={28} style={{ color: '#374151' }} />
                <p className="text-[11px] mt-3" style={{ color: '#555' }}>
                  No CVE matches against current scope targets.
                </p>
                <p className="text-[10px] mt-1" style={{ color: '#444' }}>
                  Define targets in Scope Manager to enable matching.
                </p>
              </div>
            ) : (
              matches.map((m, i) => (
                <div
                  key={`${m.cve.cveID}-${m.target}-${i}`}
                  className="rounded p-3 space-y-1.5"
                  style={{ background: '#0a0a0f', border: '1px solid #1a1a2e' }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[11px] font-bold"
                      style={{ color: '#f0c040' }}
                    >
                      {m.cve.cveID}
                    </span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded"
                      style={{ background: '#ef444420', color: '#ef4444' }}
                    >
                      MATCH
                    </span>
                  </div>
                  <p className="text-[10px]" style={{ color: '#9ca3af' }}>
                    {truncate(m.cve.shortDescription, 80)}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Crosshair size={10} style={{ color: '#00d4ff' }} />
                    <span className="text-[10px]" style={{ color: '#00d4ff' }}>
                      {m.target}
                    </span>
                  </div>
                  <p className="text-[9px]" style={{ color: '#666' }}>
                    {m.reason}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── CVE Row ──────────────────────────────────────────────────────────────────

const CVERow: FC<{ cve: CVEEntry }> = ({ cve }) => {
  const recent = isRecent(cve.dateAdded)
  const isRansomware = cve.knownRansomwareCampaignUse === 'Known'

  return (
    <div
      className="grid gap-2 px-4 py-2.5 text-xs items-center transition-colors hover:bg-white/[0.02]"
      style={{
        gridTemplateColumns: '140px 130px 1fr 90px 80px 160px',
        borderBottom: '1px solid #1a1a2e10',
      }}
    >
      {/* CVE ID */}
      <span
        className="font-bold text-[11px]"
        style={{ color: recent ? '#f0c040' : '#e5e7eb', fontFamily: FONT }}
      >
        {cve.cveID}
      </span>

      {/* Vendor / Product */}
      <div className="min-w-0">
        <p className="text-[11px] truncate" style={{ color: '#e5e7eb' }}>
          {cve.vendorProject}
        </p>
        <p className="text-[10px] truncate" style={{ color: '#666' }}>
          {cve.product}
        </p>
      </div>

      {/* Description */}
      <p
        className="text-[11px] truncate min-w-0"
        style={{ color: '#9ca3af' }}
        title={cve.shortDescription}
      >
        {cve.shortDescription}
      </p>

      {/* Date Added */}
      <span
        className="text-[10px]"
        style={{ color: recent ? '#f0c040' : '#666' }}
      >
        {cve.dateAdded}
      </span>

      {/* Ransomware Badge */}
      <span
        className="text-[9px] px-2 py-0.5 rounded text-center uppercase tracking-wider w-fit"
        style={{
          background: isRansomware ? '#ef444420' : '#374151/20',
          color: isRansomware ? '#ef4444' : '#555',
          border: `1px solid ${isRansomware ? '#ef444430' : '#1a1a2e'}`,
        }}
      >
        {isRansomware ? 'YES' : 'NO'}
      </span>

      {/* Required Action */}
      <p
        className="text-[10px] truncate min-w-0"
        style={{ color: '#666' }}
        title={cve.requiredAction}
      >
        {cve.requiredAction}
      </p>
    </div>
  )
}

// ── Loading State ────────────────────────────────────────────────────────────

const LoadingState: FC = () => (
  <div className="flex flex-col items-center justify-center py-20">
    <RefreshCw
      size={28}
      className="animate-spin mb-3"
      style={{ color: '#f0c040' }}
    />
    <p className="text-xs" style={{ color: '#9ca3af' }}>
      Loading CISA KEV catalog...
    </p>
  </div>
)

// ── Empty State ──────────────────────────────────────────────────────────────

const EmptyState: FC<{ hasFilter: boolean }> = ({ hasFilter }) => (
  <div className="flex flex-col items-center justify-center py-20">
    <Bug size={32} style={{ color: '#374151' }} />
    <p className="text-xs mt-3" style={{ color: '#9ca3af' }}>
      {hasFilter
        ? 'No CVEs match the current filters.'
        : 'No CVE data available.'}
    </p>
    <p className="text-[10px] mt-1" style={{ color: '#555' }}>
      {hasFilter
        ? 'Try broadening your search or clearing filters.'
        : 'Hit REFRESH to pull the latest CISA KEV catalog.'}
    </p>
  </div>
)

export default CVEMonitor
