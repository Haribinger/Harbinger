type EventHandler = (...args: any[]) => void;

class SimpleEventEmitter {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        handler(...args);
      } catch (err) {
        console.error(`[Orchestrator] Event handler error for "${event}":`, err);
      }
    });
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

interface AgentConfig {
  id: string;
  type: string;
  status: 'spawned' | 'initializing' | 'heartbeat' | 'working' | 'handoff' | 'reporting' | 'stopped';
  personality: string;
  codename: string;
  currentTask: string;
  toolsCount: number;
  findingsCount: number;
}

class AgentOrchestrator extends SimpleEventEmitter {
  private agents: Map<string, AgentConfig> = new Map();

  constructor() {
    super();
  }

  spawnAgent(agentType: string, personality: string, codename: string): AgentConfig {
    const id = `agent-${Date.now()}`;
    const newAgent: AgentConfig = {
      id,
      type: agentType,
      status: 'spawned',
      personality,
      codename,
      currentTask: 'Initializing',
      toolsCount: 0,
      findingsCount: 0,
    };
    this.agents.set(id, newAgent);
    this.emit('agentStatusChange', newAgent);
    console.log(`Agent ${id} spawned.`);
    return newAgent;
  }

  stopAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = 'stopped';
      this.emit('agentStatusChange', agent);
      this.agents.delete(agentId);
      console.log(`Agent ${agentId} stopped.`);
    }
  }

  updateAgentStatus(agentId: string, status: AgentConfig['status'], currentTask?: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      if (currentTask) {
        agent.currentTask = currentTask;
      }
      this.emit('agentStatusChange', agent);
    }
  }

  getAgent(agentId: string): AgentConfig | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): AgentConfig[] {
    return Array.from(this.agents.values());
  }

  handleHeartbeat(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = 'heartbeat';
      this.emit('agentStatusChange', agent);
    }
  }

  handoffTask(fromAgentId: string, toAgentId: string, task: string): void {
    const fromAgent = this.agents.get(fromAgentId);
    const toAgent = this.agents.get(toAgentId);

    if (fromAgent && toAgent) {
      fromAgent.status = 'handoff';
      fromAgent.currentTask = `Handoff to ${toAgent.codename}`;
      this.emit('agentStatusChange', fromAgent);

      toAgent.status = 'working';
      toAgent.currentTask = task;
      this.emit('agentStatusChange', toAgent);

      console.log(`Task handoff from ${fromAgent.codename} to ${toAgent.codename}: ${task}`);
      this.emit('taskHandoff', { fromAgentId, toAgentId, task });
    }
  }

  // Agent-to-agent communication (findings sharing, task delegation)
  shareFindings(fromAgentId: string, toAgentId: string, findings: any): void {
    const fromAgent = this.agents.get(fromAgentId);
    const toAgent = this.agents.get(toAgentId);

    if (fromAgent && toAgent) {
      console.log(`Agent ${fromAgent.codename} sharing findings with ${toAgent.codename}.`);
      // In a real scenario, this would involve more complex data transfer
      this.emit('findingsShared', { fromAgentId, toAgentId, findings });
    }
  }
}

export const agentOrchestrator = new AgentOrchestrator();
