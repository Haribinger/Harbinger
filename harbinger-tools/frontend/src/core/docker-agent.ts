interface DockerAgentConfig {
  agentType: string
  agentName: string
  image: string
  environment: Record<string, string>
  volumeMounts: Array<{ source: string; destination: string }>
  ports: Array<{ containerPort: number; hostPort?: number }>
  resourceLimits?: {
    cpuLimit: string
    memoryLimit: string
  }
}

interface DockerAgentContainer {
  containerId: string
  agentType: string
  agentName: string
  status: 'created' | 'running' | 'paused' | 'stopped' | 'exited'
  image: string
  createdAt: string
  startedAt?: string
  stoppedAt?: string
  logs: string[]
}

class DockerAgentManager {
  private containers: Map<string, DockerAgentContainer> = new Map();
  private agentTypeImages = {
    'recon-scout': 'harbinger/recon-scout:latest',
    'exploit-dev': 'harbinger/exploit-dev:latest',
    'report-writer': 'harbinger/report-writer:latest',
    'default': 'harbinger/agent:latest',
  };

  async spawnAgentContainer(config: DockerAgentConfig): Promise<DockerAgentContainer> {
    const containerId = `agent-${Date.now()}`;
    const image = this.agentTypeImages[config.agentType] || this.agentTypeImages['default'];

    const container: DockerAgentContainer = {
      containerId,
      agentType: config.agentType,
      agentName: config.agentName,
      status: 'created',
      image,
      createdAt: new Date().toISOString(),
      logs: [],
    };

    this.containers.set(containerId, container);

    try {
      // Simulate container creation
      await this.createContainer(containerId, config);
      container.status = 'running';
      container.startedAt = new Date().toISOString();
      this.containers.set(containerId, container);

      console.log(`Agent container spawned: ${containerId} (${config.agentType})`);
    } catch (error) {
      container.status = 'exited';
      container.stoppedAt = new Date().toISOString();
      this.containers.set(containerId, container);
      throw error;
    }

    return container;
  }

  async stopContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    container.status = 'stopped';
    container.stoppedAt = new Date().toISOString();
    this.containers.set(containerId, container);

    console.log(`Agent container stopped: ${containerId}`);
  }

  async removeContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    this.containers.delete(containerId);
    console.log(`Agent container removed: ${containerId}`);
  }

  async getContainerLogs(containerId: string): Promise<string[]> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    return container.logs;
  }

  async addContainerLog(containerId: string, message: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    container.logs.push(`[${new Date().toISOString()}] ${message}`);
    this.containers.set(containerId, container);
  }

  getContainer(containerId: string): DockerAgentContainer | undefined {
    return this.containers.get(containerId);
  }

  getAllContainers(): DockerAgentContainer[] {
    return Array.from(this.containers.values());
  }

  getContainersByStatus(status: string): DockerAgentContainer[] {
    return Array.from(this.containers.values()).filter(c => c.status === status);
  }

  private async createContainer(containerId: string, config: DockerAgentConfig): Promise<void> {
    // Simulate container creation
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Container ${containerId} created with config:`, config);
        resolve();
      }, 1000);
    });
  }
}

export const dockerAgentManager = new DockerAgentManager();
