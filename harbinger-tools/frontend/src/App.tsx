import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState, lazy, Suspense } from 'react'
import { useThemeStore, applyTheme } from './store/themeStore'
import { API_BASE } from './config'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout/Layout'
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute'
import './App.css'

// Lazy-loaded pages — split into separate chunks for faster initial load
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'))
const Chat = lazy(() => import('./pages/Chat/Chat'))
const Agents = lazy(() => import('./pages/Agents/Agents'))
const Workflows = lazy(() => import('./pages/Workflows/Workflows'))
const MCPManager = lazy(() => import('./pages/MCPManager/MCPManager'))
const DockerManager = lazy(() => import('./pages/DockerManager/DockerManager'))
const BrowserManager = lazy(() => import('./pages/BrowserManager/BrowserManager'))
const Settings = lazy(() => import('./pages/Settings/Settings'))
const RedTeam = lazy(() => import('./pages/RedTeam/RedTeam'))
const BountyHub = lazy(() => import('./pages/BountyHub/BountyHub'))
const CommandCenter = lazy(() => import('./pages/CommandCenter/CommandCenter'))
const SkillsHub = lazy(() => import('./pages/SkillsHub/SkillsHub'))
const OpenClaw = lazy(() => import('./pages/OpenClaw/OpenClaw'))
const WorkflowEditor = lazy(() => import('./pages/WorkflowEditor'))
const CodeHealth = lazy(() => import('./pages/CodeHealth/CodeHealth'))
const ScopeManager = lazy(() => import('./pages/ScopeManager/ScopeManager'))
const VulnDeepDive = lazy(() => import('./pages/VulnDeepDive/VulnDeepDive'))
const RemediationTracker = lazy(() => import('./pages/RemediationTracker/RemediationTracker'))
const Autonomous = lazy(() => import('./pages/Autonomous/Autonomous'))
const PentestDashboard = lazy(() => import('./pages/PentestDashboard/PentestDashboard'))
const CVEMonitor = lazy(() => import('./pages/CVEMonitor/CVEMonitor'))
const FindingsFeed = lazy(() => import('./pages/FindingsFeed/FindingsFeed'))
const AgentShell = lazy(() => import('./pages/AgentShell/AgentShell'))
const MissionControl = lazy(() => import('./pages/MissionControl/MissionControl'))
const Login = lazy(() => import('./pages/Login/Login'))
const SetupWizard = lazy(() => import('./pages/Setup/SetupWizard'))

// Page loading spinner — matches Obsidian Command theme
function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#0a0a0f]">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: '#1a1a2e', borderTopColor: '#f0c040' }}
        />
        <span className="text-xs text-gray-500 font-mono">Loading module...</span>
      </div>
    </div>
  )
}

// SSE Route handler
function SSERoute() {
  return null
}

// Setup check wrapper — verifies backend is reachable before routing
function SetupCheck({ children }: { children: React.ReactNode }) {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  const [backendDown, setBackendDown] = useState(false)
  const location = useLocation()

  useEffect(() => {
    fetch(`${API_BASE}/api/setup/status`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => setNeedsSetup(data.needsSetup === true))
      .catch(() => {
        // Backend unreachable — assume setup needed so user can configure
        setBackendDown(true)
        setNeedsSetup(true)
      })
  }, [])

  if (needsSetup === null) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div
          className="w-8 h-8 border-4 rounded-full animate-spin"
          style={{ borderColor: '#f0c040', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  // If on the setup page, always allow through (even if backend is down)
  if (location.pathname === '/setup') {
    return <>{children}</>
  }

  // Show clear error when backend is not reachable (for non-setup pages)
  if (backendDown) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        color: '#9ca3af',
        gap: '16px',
        padding: '24px',
        textAlign: 'center',
      }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#ef444420', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#ef4444', fontSize: '24px' }}>!</span>
        </div>
        <h2 style={{ color: '#f0c040', fontSize: '18px', margin: 0, letterSpacing: '0.1em' }}>BACKEND UNREACHABLE</h2>
        <p style={{ maxWidth: '420px', fontSize: '12px', lineHeight: 1.7 }}>
          Cannot connect to the Harbinger API server.
        </p>
        <div style={{ background: '#0d0d15', border: '1px solid #1a1a2e', borderRadius: '8px', padding: '16px', fontSize: '11px', textAlign: 'left', maxWidth: '420px', width: '100%' }}>
          <p style={{ color: '#f0c040', marginTop: 0, marginBottom: '8px' }}>Start the backend:</p>
          <code style={{ color: '#22c55e' }}>cd backend && go run ./cmd/</code>
          <p style={{ color: '#f0c040', marginTop: '12px', marginBottom: '8px' }}>Or with Docker:</p>
          <code style={{ color: '#22c55e' }}>docker compose up -d</code>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              background: 'transparent',
              border: '1px solid #f0c040',
              borderRadius: '4px',
              color: '#f0c040',
              fontSize: '11px',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            RETRY CONNECTION
          </button>
          <button
            onClick={() => { setBackendDown(false); setNeedsSetup(true) }}
            style={{
              padding: '10px 24px',
              background: 'transparent',
              border: '1px solid #1a1a2e',
              borderRadius: '4px',
              color: '#9ca3af',
              fontSize: '11px',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            RUN SETUP ANYWAY
          </button>
        </div>
      </div>
    )
  }

  // Redirect to setup if needed (from any page including /login)
  if (needsSetup && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />
  }

  // Already configured — redirect away from setup
  if (!needsSetup && location.pathname === '/setup') {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Teleport handler — picks up ?teleport=<id> from CLI, fetches context, navigates
function useTeleportHandler() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const teleportId = params.get('teleport')
    if (!teleportId) return

    // Clean URL immediately
    window.history.replaceState({}, '', location.pathname)

    fetch(`${API_BASE}/api/teleport/pull?id=${encodeURIComponent(teleportId)}`)
      .then(res => res.json())
      .then(data => {
        if (!data.ok || !data.context) return
        const ctx = data.context as Record<string, unknown>
        // Route based on context type
        if (ctx.page) {
          navigate(String(ctx.page))
        } else if (ctx.agentId) {
          navigate(`/agents?agentId=${ctx.agentId}`)
        } else if (ctx.workflowId) {
          navigate(`/workflow-editor/${ctx.workflowId}`)
        }
        // Default: stay on current page (context received but no routing hint)
      })
      .catch(() => {
        // Silent — teleport is best-effort
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount
}

function AnimatedRoutes() {
  const location = useLocation()
  useTeleportHandler()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Setup Route - Public */}
        <Route path="/setup" element={
          <Suspense fallback={<PageLoader />}>
            <SetupWizard />
          </Suspense>
        } />

        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Suspense fallback={<PageLoader />}>
                <Login />
              </Suspense>
            </PublicRoute>
          }
        />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
          <Route path="command-center" element={<Suspense fallback={<PageLoader />}><CommandCenter /></Suspense>} />
          <Route path="chat/:agentId?" element={<Suspense fallback={<PageLoader />}><Chat /></Suspense>} />
          <Route path="agents" element={<Suspense fallback={<PageLoader />}><Agents /></Suspense>} />
          <Route path="workflows" element={<Suspense fallback={<PageLoader />}><Workflows /></Suspense>} />
          <Route path="workflow-editor" element={<Suspense fallback={<PageLoader />}><WorkflowEditor /></Suspense>} />
          <Route path="workflow-editor/:id" element={<Suspense fallback={<PageLoader />}><WorkflowEditor /></Suspense>} />
          <Route path="mcp" element={<Suspense fallback={<PageLoader />}><MCPManager /></Suspense>} />
          <Route path="docker" element={<Suspense fallback={<PageLoader />}><DockerManager /></Suspense>} />
          <Route path="browsers" element={<Suspense fallback={<PageLoader />}><BrowserManager /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
          <Route path="redteam" element={<Suspense fallback={<PageLoader />}><RedTeam /></Suspense>} />
          <Route path="skills" element={<Suspense fallback={<PageLoader />}><SkillsHub /></Suspense>} />
          <Route path="bounty-hub" element={<Suspense fallback={<PageLoader />}><BountyHub /></Suspense>} />
          <Route path="openclaw" element={<Suspense fallback={<PageLoader />}><OpenClaw /></Suspense>} />
          <Route path="code-health" element={<Suspense fallback={<PageLoader />}><CodeHealth /></Suspense>} />
          <Route path="scope-manager" element={<Suspense fallback={<PageLoader />}><ScopeManager /></Suspense>} />
          <Route path="vuln-deep-dive" element={<Suspense fallback={<PageLoader />}><VulnDeepDive /></Suspense>} />
          <Route path="remediation" element={<Suspense fallback={<PageLoader />}><RemediationTracker /></Suspense>} />
          <Route path="autonomous" element={<Suspense fallback={<PageLoader />}><Autonomous /></Suspense>} />
          <Route path="pentest-dashboard" element={<Suspense fallback={<PageLoader />}><PentestDashboard /></Suspense>} />
          <Route path="cve-monitor" element={<Suspense fallback={<PageLoader />}><CVEMonitor /></Suspense>} />
          <Route path="findings" element={<Suspense fallback={<PageLoader />}><FindingsFeed /></Suspense>} />
          <Route path="agent-shell" element={<Suspense fallback={<PageLoader />}><AgentShell /></Suspense>} />
          <Route path="mission-control" element={<Suspense fallback={<PageLoader />}><MissionControl /></Suspense>} />
          <Route path="sse" element={<SSERoute />} />
          <Route path="*" element={<div className="p-8 text-center font-mono text-gray-400">404 // Page not found</div>} />
        </Route>
      </Routes>
    </AnimatePresence>
  )
}

function App() {
  useEffect(() => {
    const theme = useThemeStore.getState().getActiveTheme()
    applyTheme(theme.tokens, theme.fontFamily)
    const interval = setInterval(() => {
      useThemeStore.getState().checkSchedule()
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <ErrorBoundary>
      <SetupCheck>
        <AnimatedRoutes />
        <Toaster position="top-right" />
      </SetupCheck>
    </ErrorBoundary>
  )
}

export default App
