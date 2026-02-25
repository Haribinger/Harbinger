import { NavLink } from 'react-router-dom'
import {
  MessageSquare,
  Bot,
  Workflow,
  Puzzle,
  Container,
  Globe,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Zap,
  Swords,
} from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'

interface NavItem {
  path: string
  label: string
  icon: React.ElementType
  badge?: number
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: Zap },
  { path: '/chat', label: 'Chat', icon: MessageSquare },
  { path: '/agents', label: 'Agents', icon: Bot },
  { path: '/workflows', label: 'Workflows', icon: Workflow },
  { path: '/mcp', label: 'MCP Tools', icon: Puzzle },
  { path: '/docker', label: 'Docker', icon: Container },
  { path: '/browsers', label: 'Browsers', icon: Globe },
  { path: '/redteam', label: 'Red Team', icon: Swords },
]

const bottomNavItems: NavItem[] = [
  { path: '/settings', label: 'Settings', icon: Settings },
]

function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useSettingsStore()

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-surface border-r border-border flex flex-col transition-all duration-300 z-50 ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-bold text-lg">Harbinger</span>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="p-1.5 hover:bg-surface-light rounded-lg transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4 text-text-secondary" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-text-secondary" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-text-secondary hover:bg-surface-light hover:text-text-primary'
              } ${sidebarCollapsed ? 'justify-center' : ''}`
            }
            title={sidebarCollapsed ? item.label : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && (
              <span className="font-medium">{item.label}</span>
            )}
            {!sidebarCollapsed && item.badge && (
              <span className="ml-auto bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="py-4 px-2 border-t border-border space-y-1">
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400'
                  : 'text-text-secondary hover:bg-surface-light hover:text-text-primary'
              } ${sidebarCollapsed ? 'justify-center' : ''}`
            }
            title={sidebarCollapsed ? item.label : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && (
              <span className="font-medium">{item.label}</span>
            )}
          </NavLink>
        ))}
      </div>
    </aside>
  )
}

export default Sidebar
