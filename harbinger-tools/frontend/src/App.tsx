import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState, lazy, Suspense } from 'react'
import { useThemeStore, applyTheme } from './store/themeStore'
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

// Setup check wrapper
function SetupCheck({ children }: { children: React.ReactNode }) {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  const location = useLocation()

  useEffect(() => {
    fetch('/api/setup/status')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => setNeedsSetup(data.needsSetup === true))
      .catch(() => {
        setNeedsSetup(false)
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

  if (needsSetup && location.pathname !== '/setup' && location.pathname !== '/login') {
    return <Navigate to="/setup" replace />
  }

  if (!needsSetup && location.pathname === '/setup') {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AnimatedRoutes() {
  const location = useLocation()

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
          <Route path="mcp" element={<Suspense fallback={<PageLoader />}><MCPManager /></Suspense>} />
          <Route path="docker" element={<Suspense fallback={<PageLoader />}><DockerManager /></Suspense>} />
          <Route path="browsers" element={<Suspense fallback={<PageLoader />}><BrowserManager /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
          <Route path="redteam" element={<Suspense fallback={<PageLoader />}><RedTeam /></Suspense>} />
          <Route path="skills" element={<Suspense fallback={<PageLoader />}><SkillsHub /></Suspense>} />
          <Route path="bounty-hub" element={<Suspense fallback={<PageLoader />}><BountyHub /></Suspense>} />
          <Route path="openclaw" element={<Suspense fallback={<PageLoader />}><OpenClaw /></Suspense>} />
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
