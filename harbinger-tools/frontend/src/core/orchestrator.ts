import { agentsApi } from '../api/agents'
import { autonomousApi } from '../api/autonomous'

type EventHandler = (...args: any[]) => void

class SimpleEventEmitter {
  private listeners: Map<string, Set<EventHandler>> = new Map()

  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler)
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        handler(...args)
      } catch (err) {
        console.error(`[Orchestrator] Event handler error for "${event}":`, err)
      }
    })
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }
}

interface AgentConfig {
  id: string
  type: string
  status: 'spawned' | 'initializing' | 'heartbeat' | 'working' | 'handoff' | 'reporting' | 'stopped' | 'running' | 'idle'
  personality: string
  codename: string
  currentTask: string
  toolsCount: number
  findingsCount: number
  containerId?: string
  soulVersion?: string
  soul?: string
}

class AgentOrchestrator extends SimpleEventEmitter {
  private agents: Map<string, AgentConfig> = new Map()
  private heartbeatTimers: Map<string, ReturnType<typeof setInterval>> = new Map()

  constructor() {
    super()
  }

  /** Spawn an agent — calls backend POST /api/agents/{id}/spawn which creates a Docker container */
  async spawnAgent(agentId: string): Promise<AgentConfig | null> {
    try {
      const result = await agentsApi.spawn(agentId)
      if (!result.ok) {
        console.error(`[Orchestrator] Spawn failed:`, result.error)
        this.emit('error', { agentId, error: result.error })
        return null
      }

      // Fetch fresh agent state from backend
      const status = await agentsApi.getStatus(agentId)
      const config: AgentConfig = {
        id: agentId,
        type: status.agent?.type || 'unknown',
        status: 'running',
        personality: status.agent?.name || '',
        codename: status.agent?.name || '',
        currentTask: 'Container started',
        toolsCount: status.agent?.capabilities?.length || 0,
        findingsCount: 0,
        containerId: result.container_id,
      }

      this.agents.set(agentId, config)
      this.emit('agentStatusChange', config)

      // Load agent soul from profile directory
      agentsApi.getSoul(agentId).then((soulResult) => {
        if (soulResult.ok && soulResult.soul) {
          config.soul = soulResult.soul
          config.soulVersion = soulResult.soul_version
          this.emit('agentSoulLoaded', { agentId, soul: soulResult.soul, version: soulResult.soul_version })
        }
      }).catch(() => { /* soul load is best-effort */ })

      // Start heartbeat polling for this agent
      this.startHeartbeat(agentId)

      console.log(`[Orchestrator] Agent ${agentId} spawned → container ${result.container_id}`)
      return config
    } catch (err: any) {
      console.error('[Orchestrator] Spawn error:', err)
      this.emit('error', { agentId, error: err.message })
      return null
    }
  }

  /** Create a new agent in the DB (for the create modal) */
  async createAndSpawn(name: string, type: string, description: string, capabilities: string[]): Promise<AgentConfig | null> {
    try {
      const agent = await agentsApi.create({ name, type, description, capabilities })
      return this.spawnAgent(agent.id)
    } catch (err: any) {
      console.error('[Orchestrator] Create+Spawn error:', err)
      return null
    }
  }

  /** Stop an agent — calls backend POST /api/agents/{id}/stop */
  async stopAgent(agentId: string): Promise<void> {
    try {
      await agentsApi.stop(agentId)
      const config = this.agents.get(agentId)
      if (config) {
        config.status = 'stopped'
        config.containerId = undefined
        this.emit('agentStatusChange', config)
      }
      this.stopHeartbeat(agentId)
      this.agents.delete(agentId)
      console.log(`[Orchestrator] Agent ${agentId} stopped`)
    } catch (err: any) {
      console.error('[Orchestrator] Stop error:', err)
    }
  }

  updateAgentStatus(agentId: string, status: AgentConfig['status'], currentTask?: string): void {
    const agent = this.agents.get(agentId)
    if (agent) {
      agent.status = status
      if (currentTask) {
        agent.currentTask = currentTask
      }
      this.emit('agentStatusChange', agent)
    }
  }

  getAgent(agentId: string): AgentConfig | undefined {
    return this.agents.get(agentId)
  }

  getAllAgents(): AgentConfig[] {
    return Array.from(this.agents.values())
  }

  /** Poll agent status from backend and emit events */
  private startHeartbeat(agentId: string): void {
    this.stopHeartbeat(agentId) // Clear existing
    const timer = setInterval(async () => {
      try {
        const result = await agentsApi.heartbeat(agentId)
        const config = this.agents.get(agentId)
        if (config) {
          config.status = 'running'

          // Detect soul version changes (hot-reload of SOUL.md)
          if (result.soul_version && config.soulVersion && result.soul_version !== config.soulVersion) {
            console.log(`[Orchestrator] Soul updated for ${agentId}, reloading...`)
            config.soulVersion = result.soul_version
            agentsApi.getSoul(agentId).then((soulResult) => {
              if (soulResult.ok && soulResult.soul) {
                config.soul = soulResult.soul
                this.emit('agentSoulUpdated', { agentId, soul: soulResult.soul, version: soulResult.soul_version })
              }
            }).catch(() => { /* soul load is best-effort */ })
          }

          this.emit('agentStatusChange', config)
        }
      } catch {
        // Agent may have stopped
        const config = this.agents.get(agentId)
        if (config) {
          config.status = 'stopped'
          this.emit('agentStatusChange', config)
          this.stopHeartbeat(agentId)
        }
      }
    }, 15000) // Every 15 seconds
    this.heartbeatTimers.set(agentId, timer)
  }

  private stopHeartbeat(agentId: string): void {
    const timer = this.heartbeatTimers.get(agentId)
    if (timer) {
      clearInterval(timer)
      this.heartbeatTimers.delete(agentId)
    }
  }

  /** Get agent logs from backend (streamed from Docker) */
  async getAgentLogs(agentId: string, tail = 200): Promise<string> {
    try {
      return await agentsApi.getLogs(agentId, tail)
    } catch {
      return '[No logs available]'
    }
  }

  /** Handle heartbeat (called from agent-runtime) */
  handleHeartbeat(agentId: string): void {
    const config = this.agents.get(agentId)
    if (config) {
      config.status = 'running'
      this.emit('agentStatusChange', config)
    }
    // Also send to backend
    agentsApi.heartbeat(agentId).catch(() => {})
  }

  handoffTask(fromAgentId: string, toAgentId: string, task: string): void {
    const fromAgent = this.agents.get(fromAgentId)
    const toAgent = this.agents.get(toAgentId)

    if (fromAgent && toAgent) {
      fromAgent.status = 'handoff'
      fromAgent.currentTask = `Handoff to ${toAgent.codename}`
      this.emit('agentStatusChange', fromAgent)

      toAgent.status = 'working'
      toAgent.currentTask = task
      this.emit('agentStatusChange', toAgent)

      console.log(`[Orchestrator] Handoff: ${fromAgent.codename} → ${toAgent.codename}: ${task}`)
      this.emit('taskHandoff', { fromAgentId, toAgentId, task })
    }
  }

  shareFindings(fromAgentId: string, toAgentId: string, findings: any): void {
    const fromAgent = this.agents.get(fromAgentId)
    const toAgent = this.agents.get(toAgentId)

    if (fromAgent && toAgent) {
      console.log(`[Orchestrator] ${fromAgent.codename} sharing findings with ${toAgent.codename}`)
      this.emit('findingsShared', { fromAgentId, toAgentId, findings })
    }
  }

  /** Report an autonomous thought from this agent */
  async reportThought(agentId: string, thought: {
    type: string; category: string; title: string; content: string; priority?: number
  }): Promise<void> {
    const agent = this.agents.get(agentId)
    try {
      await autonomousApi.createThought({
        agent_id: agentId,
        agent_name: agent?.codename || agentId,
        type: thought.type as any,
        category: thought.category as any,
        title: thought.title,
        content: thought.content,
        priority: thought.priority || 3,
      })
      this.emit('autonomousThought', { agentId, thought })
    } catch (err: any) {
      console.error('[Orchestrator] Failed to report thought:', err.message)
    }
  }

  /** Clean up all timers on unmount */
  destroy(): void {
    for (const [id] of this.heartbeatTimers) {
      this.stopHeartbeat(id)
    }
    this.removeAllListeners()
  }
}

export const agentOrchestrator = new AgentOrchestrator()
