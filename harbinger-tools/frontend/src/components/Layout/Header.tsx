import { useState } from 'react'
import { Bell, Search, Plus, X, LogOut, User, Github, ChevronDown } from 'lucide-react'
import { useAgentStore } from '../../store/agentStore'
import { useAuthStore } from '../../store/authStore'

function Header() {
  const [showSearch, setShowSearch] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { activeAgent } = useAgentStore()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {activeAgent ? (
            <>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                style={{ backgroundColor: activeAgent.color }}
              >
                {activeAgent.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{activeAgent.name}</p>
                <p className="text-xs text-text-secondary">{activeAgent.status}</p>
              </div>
            </>
          ) : (
            <p className="text-text-secondary">No active agent</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className={`relative ${showSearch ? 'w-64' : 'w-auto'}`}>
          {showSearch ? (
            <div className="flex items-center">
              <input
                type="text"
                placeholder="Search..."
                className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary"
                autoFocus
              />
              <button
                onClick={() => setShowSearch(false)}
                className="absolute right-2 p-1 hover:bg-surface rounded"
              >
                <X className="w-4 h-4 text-text-secondary" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 hover:bg-surface-light rounded-lg transition-colors"
            >
              <Search className="w-5 h-5 text-text-secondary" />
            </button>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 hover:bg-surface-light rounded-lg transition-colors relative"
          >
            <Bell className="w-5 h-5 text-text-secondary" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-lg shadow-xl z-50">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold">Notifications</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <div className="p-4 hover:bg-surface-light cursor-pointer">
                  <p className="text-sm font-medium">Agent task completed</p>
                  <p className="text-xs text-text-secondary">Security scan finished</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* New Chat Button */}
        <button className="flex items-center gap-2 px-4 py-2 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">New Chat</span>
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-2 hover:bg-surface-light rounded-lg transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#f0c040]/20 border border-[#f0c040]/50 flex items-center justify-center text-[#f0c040] text-sm font-medium"
            >
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <ChevronDown className="w-4 h-4 text-text-secondary" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-border rounded-lg shadow-xl z-50">
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#f0c040]/20 border border-[#f0c040]/50 flex items-center justify-center text-[#f0c040] font-medium"
                  >
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-medium text-white">{user?.username || 'User'}</p>
                    <p className="text-xs text-text-secondary">{user?.email || 'No email'}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Github className="w-3 h-3 text-text-secondary" />
                  <span className="text-xs text-text-secondary capitalize">
                    {user?.provider || 'local'} auth
                  </span>
                </div>
              </div>
              <div className="p-2">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
