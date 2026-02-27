import EventEmitter from 'events'
import { agentOrchestrator } from './orchestrator'
import { mcpClient } from './mcp-client'

interface AgentConfig {
  name: string
  description: string
  tools: string[]
  memory: Record<string, unknown>
  knowledge: Record<string, unknown>
  systemPrompt?: string
  dockerImage?: string
}

class AgentRuntime extends EventEmitter {
  private agentId: string
  private config: AgentConfig | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor(agentId: string) {
    super()
    this.agentId = agentId
  }

  async loadConfig(agentType: string): Promise<void> {
    agentOrchestrator.updateAgentStatus(this.agentId, 'initializing', 'Loading config')

    try {
      // Load agent config from backend API
      const res = await fetch(`/api/agents/${this.agentId}/config`)
      if (res.ok) {
        const data = await res.json()
        this.config = {
          name: data.name || agentType,
          description: data.description || '',
          tools: Array.isArray(data.tools) ? data.tools : [],
          memory: data.memory || {},
          knowledge: data.knowledge || {},
          systemPrompt: data.systemPrompt || data.system_prompt || '',
          dockerImage: data.dockerImage || data.docker_image || '',
        }
      } else {
        // Fall back to template from agent type
        const templateRes = await fetch('/api/agents/templates')
        if (templateRes.ok) {
          const templates = await templateRes.json()
          const tpl = (Array.isArray(templates) ? templates : templates.templates || [])
            .find((t: Record<string, unknown>) => t.type === agentType || (t.name as string)?.toLowerCase() === agentType.toLowerCase())

          this.config = {
            name: tpl?.name || agentType,
            description: tpl?.description || `${agentType} agent`,
            tools: tpl?.capabilities || [],
            memory: {},
            knowledge: {},
            systemPrompt: tpl?.personality || '',
          }
        } else {
          // Minimal config — agent name from type
          this.config = {
            name: agentType,
            description: `${agentType} agent`,
            tools: [],
            memory: {},
            knowledge: {},
          }
        }
      }
    } catch {
      // Backend unreachable — minimal config
      this.config = {
        name: agentType,
        description: `${agentType} agent`,
        tools: [],
        memory: {},
        knowledge: {},
      }
    }

    agentOrchestrator.updateAgentStatus(this.agentId, 'heartbeat', 'Config loaded')
  }

  startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      agentOrchestrator.handleHeartbeat(this.agentId)
      this.emit('heartbeat', this.agentId)
    }, 5000)
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  async executeTool(toolName: string, params: Record<string, unknown>): Promise<unknown> {
    agentOrchestrator.updateAgentStatus(this.agentId, 'working', `Executing tool: ${toolName}`)

    try {
      // Try MCP execution first
      const servers = mcpClient.getConnectedServers()
      for (const server of servers) {
        const hasTool = server.tools.some(t => t.name === toolName)
        if (hasTool) {
          const result = await mcpClient.executeTool(server.name, toolName, params)
          this.emit('toolExecuted', { toolName, params, result })
          agentOrchestrator.updateAgentStatus(this.agentId, 'heartbeat', 'Waiting for next task')
          return result
        }
      }

      // Fall back to backend tool execution API
      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('harbinger-token') || ''}`,
        },
        body: JSON.stringify({
          agentId: this.agentId,
          tool: toolName,
          parameters: params,
        }),
      })

      if (res.ok) {
        const result = await res.json()
        this.emit('toolExecuted', { toolName, params, result })
        agentOrchestrator.updateAgentStatus(this.agentId, 'heartbeat', 'Waiting for next task')
        return result
      }

      throw new Error(`Tool ${toolName} execution failed: ${res.statusText}`)
    } catch (err) {
      agentOrchestrator.updateAgentStatus(this.agentId, 'stopped', `Tool ${toolName} failed`)
      throw err
    }
  }

  getAgentConfig(): AgentConfig | null {
    return this.config
  }

  getAgentId(): string {
    return this.agentId
  }
}

export default AgentRuntime
