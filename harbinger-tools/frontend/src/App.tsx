import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { useThemeStore, applyTheme } from './store/themeStore'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard/Dashboard'
import Chat from './pages/Chat/Chat'
import Agents from './pages/Agents/Agents'
import Workflows from './pages/Workflows/Workflows'
import MCPManager from './pages/MCPManager/MCPManager'
import DockerManager from './pages/DockerManager/DockerManager'
import BrowserManager from './pages/BrowserManager/BrowserManager'
import Settings from './pages/Settings/Settings'
import RedTeam from './pages/RedTeam/RedTeam'
import BountyHub from './pages/BountyHub/BountyHub'
import SkillsHub from './pages/SkillsHub/SkillsHub'
import OpenClaw from './pages/OpenClaw/OpenClaw'
import Login from './pages/Login/Login'
import SetupWizard from './pages/Setup/SetupWizard'
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute'
import './App.css'

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
        // Backend unreachable — skip setup, let user try to login
        // (they'll see connection errors on the login page instead of a blank screen)
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
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#f0c040', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  // If setup needed and not on setup/login page, redirect to setup
  if (needsSetup && location.pathname !== '/setup' && location.pathname !== '/login') {
    return <Navigate to="/setup" replace />
  }

  // If setup complete and on setup page, redirect to login
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
        <Route path="/setup" element={<SetupWizard />} />

        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
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
          <Route index element={<Dashboard />} />
          <Route path="chat/:agentId?" element={<Chat />} />
          <Route path="agents" element={<Agents />} />
          <Route path="workflows" element={<Workflows />} />
          <Route path="mcp" element={<MCPManager />} />
          <Route path="docker" element={<DockerManager />} />
          <Route path="browsers" element={<BrowserManager />} />
          <Route path="settings" element={<Settings />} />
          <Route path="redteam" element={<RedTeam />} />
          <Route path="skills" element={<SkillsHub />} />
          <Route path="bounty-hub" element={<BountyHub />} />
          <Route path="openclaw" element={<OpenClaw />} />
          <Route path="sse" element={<SSERoute />} />
          <Route path="*" element={<div className="p-8 text-center">Page not found</div>} />
        </Route>
      </Routes>
    </AnimatePresence>
  )
}

function App() {
  // Apply persisted theme on mount + schedule check every minute
  useEffect(() => {
    const theme = useThemeStore.getState().getActiveTheme()
    applyTheme(theme.tokens, theme.fontFamily)
    // Check theme schedule every 60s
    const interval = setInterval(() => {
      useThemeStore.getState().checkSchedule()
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <SetupCheck>
      <AnimatedRoutes />
      <Toaster position="top-right" />
    </SetupCheck>
  )
}

export default App
