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

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('harbinger-token')
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

class DockerAgentManager {
  private containers: Map<string, DockerAgentContainer> = new Map();
  private agentTypeImages: Record<string, string> = {
    'recon-scout': 'harbinger/recon-scout:latest',
    'exploit-dev': 'harbinger/exploit-dev:latest',
    'report-writer': 'harbinger/report-writer:latest',
    default: 'harbinger/agent:latest',
  };

  async spawnAgentContainer(config: DockerAgentConfig): Promise<DockerAgentContainer> {
    const image = config.image || (this.agentTypeImages[config.agentType] ?? this.agentTypeImages.default);

    // Call real Docker API on backend
    const container = await this.createContainer(config, image);
    this.containers.set(container.containerId, container);

    console.log(`Agent container spawned: ${container.containerId} (${config.agentType})`);
    return container;
  }

  async stopContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    const res = await fetch(`/api/docker/containers/${containerId}/stop`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(data.error || `Failed to stop container ${containerId}`);
    }

    container.status = 'stopped';
    container.stoppedAt = new Date().toISOString();
    this.containers.set(containerId, container);
  }

  async removeContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    const res = await fetch(`/api/docker/containers/${containerId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(data.error || `Failed to remove container ${containerId}`);
    }

    this.containers.delete(containerId);
  }

  async getContainerLogs(containerId: string): Promise<string[]> {
    const res = await fetch(`/api/docker/containers/${containerId}/logs`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      // Fall back to local cache
      const container = this.containers.get(containerId);
      return container?.logs ?? [];
    }

    const text = await res.text();
    return text.split('\n').filter(Boolean);
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

  private async createContainer(config: DockerAgentConfig, image: string): Promise<DockerAgentContainer> {
    const res = await fetch('/api/docker/containers', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        image,
        name: `harbinger-${config.agentType}-${Date.now()}`,
        env: config.environment,
        ports: config.ports,
        volumes: config.volumeMounts,
        labels: {
          'harbinger.agent.type': config.agentType,
          'harbinger.agent.name': config.agentName,
        },
        resourceLimits: config.resourceLimits,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(data.error || data.message || 'Failed to create agent container');
    }

    const data = await res.json();
    return {
      containerId: data.id || data.containerId || `agent-${Date.now()}`,
      agentType: config.agentType,
      agentName: config.agentName,
      status: 'running',
      image,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      logs: [],
    };
  }
}

export const dockerAgentManager = new DockerAgentManager();
