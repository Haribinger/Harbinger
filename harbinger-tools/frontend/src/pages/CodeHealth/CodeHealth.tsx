import { useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Code,
  Package,
  TestTube,
  Shield,
  RefreshCw,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useCodeHealthStore } from '../../store/codeHealthStore'

const FONT = 'JetBrains Mono, Fira Code, monospace'

function CodeHealth() {
  const { metrics, current, range, isLoading, setRange, refresh } = useCodeHealthStore()

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const latest = current?.latest
  const previous = current?.previous

  const getTrend = (curr: number | undefined, prev: number | undefined, invert = false) => {
    if (curr == null || prev == null) return null
    const diff = curr - prev
    if (diff === 0) return null
    // For "bad" metrics (any_types, console_logs), decrease = good (green)
    // For "good" metrics (test_coverage, score), increase = good (green)
    const isGood = invert ? diff < 0 : diff > 0
    return { diff, isGood }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-6 min-h-full"
      style={{ fontFamily: FONT }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: '#f0c040' }}>
            <Activity size={20} />
            CODE HEALTH DASHBOARD
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Tracked by MAINTAINER agent — nightly scans at 02:00 UTC
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time range selector */}
          <div className="flex rounded overflow-hidden border" style={{ borderColor: '#1a1a2e' }}>
            {(['week', 'month', 'quarter'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className="px-3 py-1.5 text-xs uppercase tracking-wider transition-colors"
                style={{
                  background: range === r ? '#f0c04020' : '#0d0d15',
                  color: range === r ? '#f0c040' : '#9ca3af',
                  borderRight: r !== 'quarter' ? '1px solid #1a1a2e' : 'none',
                }}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 rounded transition-colors"
            style={{ background: '#0d0d15', border: '1px solid #1a1a2e', color: '#9ca3af' }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="ANY TYPES"
          value={latest?.any_types ?? 0}
          icon={<Code size={16} />}
          trend={getTrend(latest?.any_types, previous?.any_types, true)}
          color="#ef4444"
        />
        <MetricCard
          label="CONSOLE.LOG"
          value={latest?.console_logs ?? 0}
          icon={<AlertTriangle size={16} />}
          trend={getTrend(latest?.console_logs, previous?.console_logs, true)}
          color="#f59e0b"
        />
        <MetricCard
          label="TEST COVERAGE"
          value={`${latest?.test_coverage ?? 0}%`}
          icon={<TestTube size={16} />}
          trend={getTrend(latest?.test_coverage, previous?.test_coverage)}
          color="#22c55e"
        />
        <MetricCard
          label="HEALTH SCORE"
          value={`${latest?.score ?? 0}/100`}
          icon={<Shield size={16} />}
          trend={getTrend(latest?.score, previous?.score)}
          color="#f0c040"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Any Types Over Time */}
        <div
          className="rounded-lg p-4"
          style={{ background: '#0d0d15', border: '1px solid #1a1a2e' }}
        >
          <h3 className="text-xs font-bold tracking-wider mb-4" style={{ color: '#9ca3af' }}>
            ANY TYPES OVER TIME
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#666', fontSize: 10, fontFamily: FONT }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fill: '#666', fontSize: 10, fontFamily: FONT }} />
              <Tooltip
                contentStyle={{
                  background: '#0d0d15',
                  border: '1px solid #1a1a2e',
                  borderRadius: '4px',
                  fontFamily: FONT,
                  fontSize: '11px',
                }}
              />
              <Line
                type="monotone"
                dataKey="any_types"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: '#ef4444', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Test Coverage */}
        <div
          className="rounded-lg p-4"
          style={{ background: '#0d0d15', border: '1px solid #1a1a2e' }}
        >
          <h3 className="text-xs font-bold tracking-wider mb-4" style={{ color: '#9ca3af' }}>
            TEST COVERAGE
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#666', fontSize: 10, fontFamily: FONT }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fill: '#666', fontSize: 10, fontFamily: FONT }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  background: '#0d0d15',
                  border: '1px solid #1a1a2e',
                  borderRadius: '4px',
                  fontFamily: FONT,
                  fontSize: '11px',
                }}
              />
              <Bar dataKey="test_coverage" fill="#22c55e" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Health Score Trend + Console Logs */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className="rounded-lg p-4"
          style={{ background: '#0d0d15', border: '1px solid #1a1a2e' }}
        >
          <h3 className="text-xs font-bold tracking-wider mb-4" style={{ color: '#9ca3af' }}>
            HEALTH SCORE TREND
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#666', fontSize: 10, fontFamily: FONT }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fill: '#666', fontSize: 10, fontFamily: FONT }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  background: '#0d0d15',
                  border: '1px solid #1a1a2e',
                  borderRadius: '4px',
                  fontFamily: FONT,
                  fontSize: '11px',
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#f0c040"
                strokeWidth={2}
                dot={{ fill: '#f0c040', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div
          className="rounded-lg p-4"
          style={{ background: '#0d0d15', border: '1px solid #1a1a2e' }}
        >
          <h3 className="text-xs font-bold tracking-wider mb-4" style={{ color: '#9ca3af' }}>
            CONSOLE.LOG COUNT
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#666', fontSize: 10, fontFamily: FONT }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fill: '#666', fontSize: 10, fontFamily: FONT }} />
              <Tooltip
                contentStyle={{
                  background: '#0d0d15',
                  border: '1px solid #1a1a2e',
                  borderRadius: '4px',
                  fontFamily: FONT,
                  fontSize: '11px',
                }}
              />
              <Bar dataKey="console_logs" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Issues */}
      <div
        className="rounded-lg p-4"
        style={{ background: '#0d0d15', border: '1px solid #1a1a2e' }}
      >
        <h3 className="text-xs font-bold tracking-wider mb-4" style={{ color: '#9ca3af' }}>
          RECENT ISSUES
        </h3>
        {current?.recent_issues && current.recent_issues.length > 0 ? (
          <div className="space-y-2">
            {current.recent_issues.map((issue, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded"
                style={{ background: '#0a0a0f', border: '1px solid #1a1a2e' }}
              >
                {issue.severity === 'critical' || issue.severity === 'high' ? (
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} />
                ) : (
                  <Activity size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs" style={{ color: '#e5e7eb' }}>{issue.message}</p>
                  <p className="text-[10px] mt-1" style={{ color: '#666' }}>
                    {issue.file}{issue.line ? `:${issue.line}` : ''} — {issue.date}
                  </p>
                </div>
                <span
                  className="text-[9px] px-2 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                  style={{
                    background: issue.severity === 'critical' ? '#ef444420' : issue.severity === 'high' ? '#f59e0b20' : '#22c55e20',
                    color: issue.severity === 'critical' ? '#ef4444' : issue.severity === 'high' ? '#f59e0b' : '#22c55e',
                  }}
                >
                  {issue.severity}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Package size={32} className="mx-auto mb-3" style={{ color: '#374151' }} />
            <p className="text-xs" style={{ color: '#666' }}>
              No issues recorded yet. MAINTAINER will populate this after the first nightly scan.
            </p>
          </div>
        )}
      </div>

      {/* Empty state when no metrics */}
      {metrics.length === 0 && !isLoading && (
        <div
          className="rounded-lg p-8 text-center"
          style={{ background: '#0d0d15', border: '1px dashed #1a1a2e' }}
        >
          <Activity size={40} className="mx-auto mb-3" style={{ color: '#374151' }} />
          <p className="text-sm" style={{ color: '#9ca3af' }}>No scan data yet</p>
          <p className="text-xs mt-1" style={{ color: '#666' }}>
            MAINTAINER runs nightly at 02:00 UTC, or trigger manually via the maintenance skill.
          </p>
        </div>
      )}
    </motion.div>
  )
}

// ── Metric Card Component ────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon,
  trend,
  color,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  trend: { diff: number; isGood: boolean } | null
  color: string
}) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: '#0d0d15', border: '1px solid #1a1a2e' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] tracking-wider" style={{ color: '#9ca3af' }}>
          {label}
        </span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold" style={{ color, fontFamily: FONT }}>
          {value}
        </span>
        {trend && (
          <span
            className="flex items-center gap-0.5 text-[10px]"
            style={{ color: trend.isGood ? '#22c55e' : '#ef4444' }}
          >
            {trend.isGood ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            {Math.abs(trend.diff)}
          </span>
        )}
      </div>
    </div>
  )
}

export default CodeHealth
