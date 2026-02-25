import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  Workflow,
  Puzzle,
  Container,
  Globe,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
  Target,
  Swords,
} from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/chat', icon: MessageSquare, label: 'Chat' },
  { path: '/agents', icon: Bot, label: 'Agents' },
  { path: '/workflows', icon: Workflow, label: 'Workflows' },
  { path: '/mcp', icon: Puzzle, label: 'MCP Tools' },
  { path: '/docker', icon: Container, label: 'Docker' },
  { path: '/browsers', icon: Globe, label: 'Browsers' },
  { path: '/redteam', icon: Swords, label: 'Red Team' },
  { path: '/skills', icon: BookOpen, label: 'Skills Hub' },
  { path: '/bounty-hub', icon: Target, label: 'Bounty Hub' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useSettingsStore()

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 64 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-full bg-surface border-r border-border z-50 flex flex-col"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-border">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-[#f0c040]/10 border border-[#f0c040]/50 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-[#f0c040]" />
          </div>
          <AnimatePresence mode="wait">
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="font-bold text-lg whitespace-nowrap"
              >
                Harbinger
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                    isActive
                      ? 'text-[#f0c040] bg-[#f0c040]/10'
                      : 'text-text-secondary hover:bg-surface-light hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <AnimatePresence mode="wait">
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="whitespace-nowrap text-sm font-medium"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Collapse Button */}
      <div className="p-3 border-t border-border">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-surface-light transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-5 h-5 text-text-secondary" />
          ) : (
            <div className="flex items-center gap-2 text-text-secondary">
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Collapse</span>
            </div>
          )}
        </button>
      </div>
    </motion.aside>
  )
}

export default Sidebar
