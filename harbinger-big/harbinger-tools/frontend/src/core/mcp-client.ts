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
}

class MCPClient {
  private servers: Map<string, MCPServer> = new Map();

  constructor() {
    // Initialize with default servers
    this.servers.set('hexstrike', {
      name: 'HexStrike MCP',
      url: 'http://localhost:3001',
      tools: [],
      connected: false,
    });
  }

  async connectServer(serverName: string, serverUrl: string): Promise<void> {
    try {
      const response = await fetch(`${serverUrl}/health`);
      if (response.ok) {
        const server = this.servers.get(serverName) || {
          name: serverName,
          url: serverUrl,
          tools: [],
          connected: false,
        };
        server.connected = true;
        this.servers.set(serverName, server);
        console.log(`Connected to MCP server: ${serverName}`);
      }
    } catch (error) {
      console.error(`Failed to connect to MCP server ${serverName}:`, error);
    }
  }

  async discoverTools(serverName: string): Promise<MCPTool[]> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server not found: ${serverName}`);
    }

    try {
      const response = await fetch(`${server.url}/tools`);
      if (response.ok) {
        const tools = await response.json();
        server.tools = tools;
        this.servers.set(serverName, server);
        return tools;
      }
    } catch (error) {
      console.error(`Failed to discover tools from ${serverName}:`, error);
    }

    return [];
  }

  async executeTool(serverName: string, toolName: string, parameters: Record<string, any>): Promise<any> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server not found: ${serverName}`);
    }

    if (!server.connected) {
      throw new Error(`MCP server not connected: ${serverName}`);
    }

    try {
      const response = await fetch(`${server.url}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName, parameters }),
      });

      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`Tool execution failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Failed to execute tool ${toolName}:`, error);
      throw error;
    }
  }

  getConnectedServers(): MCPServer[] {
    return Array.from(this.servers.values()).filter(s => s.connected);
  }

  getAllTools(): MCPTool[] {
    const allTools: MCPTool[] = [];
    this.servers.forEach(server => {
      allTools.push(...server.tools);
    });
    return allTools;
  }
}

export const mcpClient = new MCPClient();
