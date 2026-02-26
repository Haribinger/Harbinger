interface MCPTool {
  name: string
  description: string
  parameters: Record<string, any>
}

interface MCPServer {
  name: string
  url: string
  tools: MCPTool[]
  connected: boolean
  config?: Record<string, unknown>
}

class MCPClient {
  private servers: Map<string, MCPServer> = new Map()

  constructor() {
    // Default servers use Vite proxy / nginx paths — no hardcoded ports
    this.servers.set('hexstrike', {
      name: 'HexStrike MCP',
      url: '/mcp/hexstrike',
      tools: [],
      connected: false,
      config: { dockerService: 'harbinger-hexstrike' },
    })
    this.servers.set('pentagi', {
      name: 'PentAGI Agent',
      url: '/mcp/pentagi',
      tools: [],
      connected: false,
      config: { dockerService: 'harbinger-pentagi' },
    })
    this.servers.set('mcp-ui', {
      name: 'MCP Visualizer',
      url: '/mcp/ui',
      tools: [],
      connected: false,
      config: { dockerService: 'harbinger-mcp-ui' },
    })
    this.servers.set('redteam', {
      name: 'Red Team Ops',
      url: '/api/redteam',
      tools: [],
      connected: false,
      config: { dockerService: 'harbinger-redteam' },
    })
  }

  addServer(id: string, server: MCPServer): void {
    this.servers.set(id, server)
  }

  removeServer(id: string): void {
    this.servers.delete(id)
  }

  async connectServer(serverId: string, serverUrl?: string): Promise<boolean> {
    const server = this.servers.get(serverId)
    if (!server) return false

    const url = serverUrl || server.url
    try {
      const response = await fetch(`${url}/health`)
      if (response.ok) {
        server.connected = true
        server.url = url
        this.servers.set(serverId, server)
        // Auto-discover tools on connect
        await this.discoverTools(serverId)
        return true
      }
      return false
    } catch {
      server.connected = false
      this.servers.set(serverId, server)
      return false
    }
  }

  async disconnectServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId)
    if (server) {
      server.connected = false
      this.servers.set(serverId, server)
    }
  }

  async discoverTools(serverId: string): Promise<MCPTool[]> {
    const server = this.servers.get(serverId)
    if (!server) return []

    try {
      const response = await fetch(`${server.url}/tools`)
      if (response.ok) {
        const data = await response.json()
        const tools = Array.isArray(data) ? data : (Array.isArray(data?.tools) ? data.tools : [])
        server.tools = tools
        this.servers.set(serverId, server)
        return tools
      }
    } catch {
      // Server unreachable — tools stay empty
    }

    return server.tools
  }

  async executeTool(serverId: string, toolName: string, parameters: Record<string, any>): Promise<any> {
    const server = this.servers.get(serverId)
    if (!server) throw new Error(`MCP server not found: ${serverId}`)
    if (!server.connected) throw new Error(`MCP server not connected: ${serverId}`)

    const response = await fetch(`${server.url}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName, parameters }),
    })

    if (!response.ok) {
      throw new Error(`Tool execution failed: ${response.statusText}`)
    }

    return response.json()
  }

  getServer(id: string): MCPServer | undefined {
    return this.servers.get(id)
  }

  getConnectedServers(): MCPServer[] {
    return Array.from(this.servers.values()).filter(s => s.connected)
  }

  getAllServers(): MCPServer[] {
    return Array.from(this.servers.values())
  }

  getAllTools(): MCPTool[] {
    const allTools: MCPTool[] = []
    this.servers.forEach(server => {
      allTools.push(...server.tools)
    })
    return allTools
  }
}

export const mcpClient = new MCPClient()
