import { useState } from 'react'
import { Bell, Search, Plus, User, LogOut } from 'lucide-react'
import { useAgentStore } from '../../store/agentStore'
import CreateAgentModal from '../Agents/CreateAgentModal'

function Header() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const activeAgent = useAgentStore((state) => state.activeAgent)
  const notifications = 3 // Mock

  return (
    <>
      <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6"
      >
        <div className="flex items-center gap-4"
        >
          {/* Search */}
          <div className="relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder="Search agents, workflows, or tools..."
              className="w-80 bg-surface-light border border-border rounded-lg pl-10 pr-4 py-2 text-sm
                         placeholder:text-text-secondary focus:border-primary focus:outline-none transition-colors"
            />
          </div
          >
        </div
        >

        <div className="flex items-center gap-4"
        >
          {/* Create New */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Agent</span>
          </button
          >

          {/* Notifications */}
          <button className="relative p-2 text-text-secondary hover:text-white transition-colors"
          >
            <Bell className="w-5 h-5" />
            {notifications > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs
                               rounded-full flex items-center justify-center"
              >
                {notifications}
              </span>
            )}
          </button
          >

          {/* User */}
          <div className="flex items-center gap-3 pl-4 border-l border-border"
          >
            {activeAgent && (
              <div className="flex items-center gap-2 text-sm text-text-secondary"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: activeAgent.color }}
                />
                <span>{activeAgent.name}</span>
              </div>
            )}
            <button className="p-2 hover:bg-surface-light rounded-lg transition-colors"
            >
              <User className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-surface-light rounded-lg transition-colors text-text-secondary hover:text-red-400"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div
          >
        </div>
      </header>

      {showCreateModal && (
        <CreateAgentModal onClose={() => setShowCreateModal(false)} />
      )}
    </>
  )
}

export default Header
