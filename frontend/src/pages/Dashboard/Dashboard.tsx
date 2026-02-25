import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  MessageSquare,
  Bot,
  Container,
  Globe,
  Workflow,
  Plus,
  ArrowRight,
  Sparkles,
  Shield,
  Terminal,
  Activity,
} from 'lucide-react'
import { useAgentStore } from '../../store/agentStore'
import { useDockerStore } from '../../store/dockerStore'
import { useBrowserStore } from '../../store/browserStore'
import { useWorkflowStore } from '../../store/workflowStore'
import { useSettingsStore } from '../../store/settingsStore'
import { dockerApi } from '../../api/docker'
import { browserApi } from '../../api/browser'
import { agentsApi } from '../../api/agents'
import { workflowsApi } from '../../api/workflows'
import { dashboardApi, type ActivityItem, type ServiceHealth } from '../../api/dashboard'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

const statsCards = [
  { label: 'Active Agents', icon: Bot, color: 'from-blue-500 to-cyan-500', route: '/agents' },
  { label: 'Running Containers', icon: Container, color: 'from-green-500 to-emerald-500', route: '/docker' },
  { label: 'Browser Sessions', icon: Globe, color: 'from-purple-500 to-pink-500', route: '/browsers' },
  { label: 'Active Workflows', icon: Workflow, color: 'from-orange-500 to-red-500', route: '/workflows' },
]

const quickActions = [
  {
    id: 'chat',
    label: 'Start New Chat',
    description: 'Chat with an AI agent',
    icon: MessageSquare,
    color: 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30',
    action: 'chat',
  },
  {
    id: 'container',
    label: 'Spawn Container',
    description: 'Launch Docker environment',
    icon: Container,
    color: 'text-green-400',
    action: 'container',
  },
  {
    id: 'browser',
    label: 'Open Browser',
    description: 'Launch browser session',
    icon: Globe,
    color: 'text-purple-400',
    action: 'browser',
  },
  {
    id: 'workflow',
    label: 'Create Workflow',
    description: 'Design automation flow',
    icon: Workflow,
    color: 'text-orange-400',
    action: 'workflow',
  },
]

function Dashboard() {
  const navigate = useNavigate()
  const { agents } = useAgentStore()
  const { containers } = useDockerStore()
  const { sessions } = useBrowserStore()
  const { workflows } = useWorkflowStore()
  const { dockerDefaults } = useSettingsStore()
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth[]>([])
  const [activityError, setActivityError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const stats = {
    'Active Agents': agents.filter((a) => a.status === 'online').length,
    'Running Containers': containers.filter((c) => c.status === 'running').length,
    'Browser Sessions': sessions.filter((s) => s.status === 'active').length,
    'Active Workflows': workflows.filter((w) => w.status === 'running').length,
  }

  // Fetch real data on mount (silent fail if backend is down)
  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    await Promise.allSettled([
      // Only overwrite local data if backend returns actual results
      dockerApi.getContainers().then((data) => { if (data.length > 0) useDockerStore.getState().setContainers(data) }).catch(() => {}),
      agentsApi.getAll().then((data) => { if (data.length > 0) useAgentStore.getState().setAgents(data) }).catch(() => {}),
      browserApi.getSessions().then((data) => { if (data.length > 0) useBrowserStore.getState().setSessions(data) }).catch(() => {}),
      workflowsApi.getAll().then((data) => { if (data.length > 0) useWorkflowStore.getState().setWorkflows(data) }).catch(() => {}),
      dashboardApi.getActivity(10)
        .then(setRecentActivity)
        .catch(() => setActivityError('Backend not reachable. Run: docker compose up -d backend')),
      dashboardApi.getServiceHealth()
        .then(setServiceHealth)
        .catch(() => {}),
    ])
  }

  const handleQuickAction = async (action: string) => {
    setIsLoading(true)
    try {
      switch (action) {
        case 'chat':
          navigate('/chat')
          break
        case 'container': {
          const response = await fetch('/api/docker/containers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: dockerDefaults.pentestImage || 'vxcontrol/kali-linux',
              name: `harbinger-${Date.now()}`,
            }),
          })
          const result = await response.json()
          if (result.ok === false) {
            toast.error(result.fix || result.reason || 'Docker not available')
          } else {
            toast.success('Container created!')
            await dockerApi.getContainers().then((data) => useDockerStore.getState().setContainers(data)).catch(() => {})
            navigate('/docker')
          }
          break
        }
        case 'browser': {
          const response = await fetch('/api/browsers/sessions', { method: 'POST' })
          const result = await response.json()
          if (result.ok === false) {
            toast.error(result.fix || result.reason || 'Browser service not configured')
          } else {
            toast.success('Browser session started!')
            navigate('/browsers')
          }
          break
        }
        case 'workflow':
          navigate('/workflows')
          break
      }
    } catch (error) {
      console.error(`Action ${action} failed:`, error)
      toast.error('Backend not reachable')
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewAll = (type: string) => {
    switch (type) {
      case 'activity':
        navigate('/redteam')
        break
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full overflow-y-auto p-6"
    >
      {/* Welcome */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-8 h-8 text-indigo-400" />
          <h1 className="text-3xl font-bold">Welcome to Harbinger</h1>
        </div>
        <p className="text-text-secondary max-w-2xl">
          Your autonomous AI-powered platform for intelligent automation and security testing.
          Connect to services at ports 3001-3004 for full functionality.
        </p>
      </div>

      {/* Service Status */}
      {serviceHealth.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {serviceHealth.map((svc) => (
            <div
              key={svc.name}
              className="bg-surface rounded-lg border border-border p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-sm">{svc.name}</p>
                <p className="text-xs text-text-secondary">
                  {svc.latency != null ? `${svc.latency}ms` : svc.status}
                </p>
              </div>
              <div className={`w-2 h-2 rounded-full ${svc.status === 'connected' ? 'bg-green-500' : svc.status === 'error' ? 'bg-red-500' : 'bg-gray-500'}`} />
            </div>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statsCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => navigate(card.route)}
            className="bg-surface rounded-xl border border-border p-6 hover:border-primary/50 transition-colors cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-text-secondary text-sm mb-1">{card.label}</p>
                <p className="text-3xl font-bold">{stats[card.label as keyof typeof stats] || 0}</p>
              </div>
              <div className={`p-3 rounded-lg bg-gradient-to-br ${card.color} group-hover:scale-110 transition-transform`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-text-secondary group-hover:text-primary transition-colors">
              <span>View all</span>
              <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Recent Activity</h2>
            </div>
            <button
              onClick={() => handleViewAll('activity')}
              className="text-sm text-primary hover:underline"
            >
              View all
            </button>
          </div>
          <div className="space-y-4">
            {activityError ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="w-10 h-10 text-text-secondary mb-3 opacity-40" />
                <p className="text-sm text-text-secondary mb-1">No activity yet</p>
                <p className="text-xs text-text-secondary font-mono bg-surface-light px-3 py-1.5 rounded">
                  {activityError}
                </p>
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="w-10 h-10 text-text-secondary mb-3 opacity-40" />
                <p className="text-sm text-text-secondary">No activity yet</p>
              </div>
            ) : (
              recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 p-3 hover:bg-surface-light rounded-lg transition-colors cursor-pointer"
                  onClick={() => navigate(`/${activity.type}s`)}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    activity.type === 'docker' ? 'bg-green-500/20 text-green-400' :
                    activity.type === 'agent' ? 'bg-blue-500/20 text-blue-400' :
                    activity.type === 'browser' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-orange-500/20 text-orange-400'
                  }`}>
                    {activity.type === 'docker' ? <Container className="w-5 h-5" /> :
                     activity.type === 'agent' ? <Bot className="w-5 h-5" /> :
                     activity.type === 'browser' ? <Globe className="w-5 h-5" /> :
                     <Workflow className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{activity.action}</p>
                    <p className="text-sm text-text-secondary">{activity.target}</p>
                  </div>
                  <span className="text-xs text-text-secondary">{activity.timestamp}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Start */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Quick Start</h2>
          </div>
          <div className="space-y-3">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action.action)}
                disabled={isLoading}
                className={`w-full flex items-center gap-3 p-3 hover:bg-surface-light border border-border rounded-lg transition-all text-left disabled:opacity-50 ${
                  action.id === 'chat' ? 'bg-indigo-600/10 border-indigo-500/20 hover:border-indigo-500/40' : ''
                }`}
              >
                <action.icon className={`w-5 h-5 ${action.color}`} />
                <div className="flex-1">
                  <p className="font-medium text-sm">{action.label}</p>
                  <p className="text-xs text-text-secondary">{action.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-text-secondary" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Bug Bounty',
            description: 'Automated security scanning and reporting',
            icon: Shield,
            color: 'text-red-400',
            route: '/redteam',
          },
          {
            title: 'MCP Tools',
            description: '150+ security tools at your disposal',
            icon: Terminal,
            color: 'text-green-400',
            route: '/mcp',
          },
          {
            title: 'Browser Automation',
            description: 'Headless browser for web testing',
            icon: Globe,
            color: 'text-purple-400',
            route: '/browsers',
          },
          {
            title: 'Workflows',
            description: 'Automate complex security tasks',
            icon: Workflow,
            color: 'text-orange-400',
            route: '/workflows',
          },
        ].map((feature) => (
          <motion.button
            key={feature.title}
            onClick={() => navigate(feature.route)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-surface rounded-xl border border-border p-6 text-left hover:border-primary/50 transition-colors"
          >
            <feature.icon className={`w-8 h-8 ${feature.color} mb-3`} />
            <h3 className="font-semibold mb-1">{feature.title}</h3>
            <p className="text-sm text-text-secondary">{feature.description}</p>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}

export default Dashboard
