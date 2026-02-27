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
  ShieldCheck,
  Swords,
  BookOpen,
  Target,
  Cpu,
  Zap,
  Radio,
  Monitor,
  Activity,
  Crosshair,
  Wrench,
  Brain,
  ShieldAlert,
  Bug,
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
  { path: '/command-center', label: 'Command Center', icon: Monitor },
  { path: '/chat', label: 'Chat', icon: MessageSquare },
  { path: '/agents', label: 'Agents', icon: Bot },
  { path: '/workflows', label: 'Workflows', icon: Workflow },
  { path: '/mcp', label: 'MCP Tools', icon: Puzzle },
  { path: '/docker', label: 'Docker', icon: Container },
  { path: '/browsers', label: 'Browsers', icon: Globe },
  { path: '/redteam', label: 'Red Team', icon: Swords },
  { path: '/skills', label: 'Skills Hub', icon: BookOpen },
  { path: '/bounty-hub', label: 'Bounty Hub', icon: Target },
  { path: '/openclaw', label: 'OpenClaw', icon: Radio },
  { path: '/code-health', label: 'Code Health', icon: Activity },
  { path: '/scope-manager', label: 'Scope Manager', icon: ShieldCheck },
  { path: '/vuln-deep-dive', label: 'Vuln Deep Dive', icon: Crosshair },
  { path: '/remediation', label: 'Remediation', icon: Wrench },
  { path: '/autonomous', label: 'Autonomous', icon: Brain },
  { path: '/pentest-dashboard', label: 'Pentest', icon: ShieldAlert },
  { path: '/cve-monitor', label: 'CVE Monitor', icon: Bug },
]

const bottomNavItems: NavItem[] = [
  { path: '/settings', label: 'Settings', icon: Settings },
]

// Obsidian Command design tokens
const C = {
  bg: '#0a0a0f',
  surface: '#0d0d15',
  border: '#1a1a2e',
  gold: '#f0c040',
  muted: '#9ca3af',
  dim: '#374151',
}

function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useSettingsStore()

  return (
    <aside
      style={{
        background: C.bg,
        borderRight: `1px solid ${C.border}`,
        width: sidebarCollapsed ? '64px' : '220px',
      }}
      className="fixed left-0 top-0 h-full flex flex-col transition-all duration-300 z-50"
    >
      {/* Logo */}
      <div
        style={{ borderBottom: `1px solid ${C.border}`, height: '56px' }}
        className="flex items-center justify-between px-3 flex-shrink-0"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div
            style={{ border: `1px solid ${C.gold}40`, background: C.bg, flexShrink: 0 }}
            className="w-8 h-8 flex items-center justify-center rounded"
          >
            <Cpu size={16} style={{ color: C.gold }} />
          </div>
          {!sidebarCollapsed && (
            <span
              style={{ color: C.gold, fontFamily: 'JetBrains Mono, Fira Code, monospace' }}
              className="text-xs font-bold tracking-widest uppercase whitespace-nowrap"
            >
              HARBINGER
            </span>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          style={{ color: C.muted }}
          className="p-1 hover:opacity-80 transition-opacity flex-shrink-0"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight size={14} />
          ) : (
            <ChevronLeft size={14} />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            title={sidebarCollapsed ? item.label : undefined}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: sidebarCollapsed ? '9px 0' : '9px 10px',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              borderRadius: '2px',
              borderLeft: isActive ? `2px solid ${C.gold}` : '2px solid transparent',
              background: isActive ? `${C.gold}12` : 'transparent',
              color: isActive ? C.gold : C.muted,
              fontFamily: 'JetBrains Mono, Fira Code, monospace',
              fontSize: '11px',
              fontWeight: isActive ? 700 : 400,
              letterSpacing: '0.05em',
              textDecoration: 'none',
              transition: 'all 0.15s',
            })}
            className="group"
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={15}
                  style={{
                    color: isActive ? C.gold : C.dim,
                    flexShrink: 0,
                    transition: 'color 0.15s',
                  }}
                  className="group-hover:!text-[#f0c040]/70"
                />
                {!sidebarCollapsed && (
                  <span className="whitespace-nowrap group-hover:!text-[#f0c040]/70">
                    {item.label.toUpperCase()}
                  </span>
                )}
                {!sidebarCollapsed && item.badge != null && (
                  <span
                    style={{ background: C.gold, color: C.bg, fontFamily: 'inherit' }}
                    className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
                  >
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div style={{ borderTop: `1px solid ${C.border}` }} className="py-3 px-2 space-y-0.5">
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={sidebarCollapsed ? item.label : undefined}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: sidebarCollapsed ? '9px 0' : '9px 10px',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              borderRadius: '2px',
              borderLeft: isActive ? `2px solid ${C.gold}` : '2px solid transparent',
              background: isActive ? `${C.gold}12` : 'transparent',
              color: isActive ? C.gold : C.muted,
              fontFamily: 'JetBrains Mono, Fira Code, monospace',
              fontSize: '11px',
              fontWeight: isActive ? 700 : 400,
              letterSpacing: '0.05em',
              textDecoration: 'none',
              transition: 'all 0.15s',
            })}
            className="group"
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={15}
                  style={{
                    color: isActive ? C.gold : C.dim,
                    flexShrink: 0,
                    transition: 'color 0.15s',
                  }}
                  className="group-hover:!text-[#f0c040]/70"
                />
                {!sidebarCollapsed && (
                  <span className="whitespace-nowrap group-hover:!text-[#f0c040]/70">
                    {item.label.toUpperCase()}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* Version stamp */}
        {!sidebarCollapsed && (
          <div
            style={{
              color: C.dim,
              fontFamily: 'JetBrains Mono, Fira Code, monospace',
              borderTop: `1px solid ${C.border}`,
            }}
            className="text-[9px] tracking-widest mt-2 pt-2 text-center"
          >
            v1.1.0 // MIT
          </div>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
