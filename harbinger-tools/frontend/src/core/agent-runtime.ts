import EventEmitter from 'events';
import { agentOrchestrator } from './orchestrator';

interface AgentConfig {
  name: string;
  description: string;
  tools: string[];
  memory: any;
  knowledge: any;
}

class AgentRuntime extends EventEmitter {
  private agentId: string;
  private config: AgentConfig | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(agentId: string) {
    super();
    this.agentId = agentId;
  }

  async loadConfig(agentType: string): Promise<void> {
    // In a real scenario, this would load from a CONFIG.yaml file
    // For now, we'll use a mock config
    this.config = {
      name: agentType,
      description: `A ${agentType} agent`,
      tools: ['toolA', 'toolB'],
      memory: {}, // Placeholder for memory
      knowledge: {}, // Placeholder for knowledge
    };
    console.log(`Agent ${this.agentId} loaded config for ${agentType}.`);
    agentOrchestrator.updateAgentStatus(this.agentId, 'initializing', 'Loading config');
  }

  startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      agentOrchestrator.handleHeartbeat(this.agentId);
      this.emit('heartbeat', this.agentId);
    }, 5000); // Every 5 seconds
    console.log(`Agent ${this.agentId} heartbeat started.`);
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    console.log(`Agent ${this.agentId} heartbeat stopped.`);
  }

  async executeTool(toolName: string, params: any): Promise<any> {
    agentOrchestrator.updateAgentStatus(this.agentId, 'working', `Executing tool: ${toolName}`);
    console.log(`Agent ${this.agentId} executing tool ${toolName} with params:`, params);
    // Simulate tool execution via MCP protocol
    return new Promise(resolve => {
      setTimeout(() => {
        const result = `Result from ${toolName} with params ${JSON.stringify(params)}`;
        this.emit('toolExecuted', { toolName, params, result });
        agentOrchestrator.updateAgentStatus(this.agentId, 'heartbeat', 'Waiting for next task');
        resolve(result);
      }, 2000);
    });
  }

  getAgentConfig(): AgentConfig | null {
    return this.config;
  }
}

export default AgentRuntime;
