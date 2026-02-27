import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import ErrorBoundary from '../ErrorBoundary'
import { useSettingsStore } from '../../store/settingsStore'

function Layout() {
  const { sidebarCollapsed, theme } = useSettingsStore()

  useEffect(() => {
    // Dark theme only — ensure light class is never applied
    document.documentElement.classList.remove('light')
  }, [theme])

  return (
    <div className="flex h-screen w-screen bg-background">
      <Sidebar />
      <div
        className="flex-1 flex flex-col transition-all duration-300"
        style={{ marginLeft: sidebarCollapsed ? '64px' : '256px' }}
      >
        <Header />
        <main className="flex-1 overflow-hidden">
          <ErrorBoundary compact>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

export default Layout
