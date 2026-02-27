import EventEmitter from 'events'
import { mcpClient } from './mcp-client'

interface ToolExecutionRecord {
  id: string
  toolName: string
  serverName: string
  parameters: Record<string, unknown>
  result: unknown
  error?: string
  startTime: number
  endTime: number
  duration: number
  status: 'success' | 'error'
}

class ToolRunner extends EventEmitter {
  private executionHistory: ToolExecutionRecord[] = [];

  async executeTool(
    serverName: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<ToolExecutionRecord> {
    const executionId = `exec-${Date.now()}`;
    const startTime = Date.now();

    try {
      this.emit('toolStart', { executionId, toolName, serverName });

      const result = await mcpClient.executeTool(serverName, toolName, parameters);

      const endTime = Date.now();
      const record: ToolExecutionRecord = {
        id: executionId,
        toolName,
        serverName,
        parameters,
        result,
        startTime,
        endTime,
        duration: endTime - startTime,
        status: 'success',
      };

      this.executionHistory.push(record);
      this.emit('toolComplete', record);

      console.log(`Tool execution completed: ${toolName} (${record.duration}ms)`);
      return record;
    } catch (error) {
      const endTime = Date.now();
      const errorMessage = error instanceof Error ? error.message : String(error);
      const record: ToolExecutionRecord = {
        id: executionId,
        toolName,
        serverName,
        parameters,
        result: null,
        error: errorMessage,
        startTime,
        endTime,
        duration: endTime - startTime,
        status: 'error',
      };

      this.executionHistory.push(record);
      this.emit('toolError', record);

      console.error(`Tool execution failed: ${toolName}`, error);
      throw error;
    }
  }

  async executeToolChain(
    serverName: string,
    toolSequence: Array<{ name: string; parameters: Record<string, unknown> }>
  ): Promise<ToolExecutionRecord[]> {
    const records: ToolExecutionRecord[] = [];
    let previousResult: unknown = null;

    for (const tool of toolSequence) {
      try {
        // If previous result exists, inject it into parameters
        const params = previousResult
          ? { ...tool.parameters, previousResult }
          : tool.parameters;

        const record = await this.executeTool(serverName, tool.name, params);
        records.push(record);
        previousResult = record.result;

        this.emit('chainProgress', { completedTools: records.length, totalTools: toolSequence.length });
      } catch (error) {
        console.error(`Tool chain interrupted at ${tool.name}:`, error);
        break;
      }
    }

    return records;
  }

  getExecutionHistory(): ToolExecutionRecord[] {
    return [...this.executionHistory];
  }

  getExecutionStats(): {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    averageDuration: number
    totalDuration: number
  } {
    const stats = {
      totalExecutions: this.executionHistory.length,
      successfulExecutions: this.executionHistory.filter(r => r.status === 'success').length,
      failedExecutions: this.executionHistory.filter(r => r.status === 'error').length,
      averageDuration: 0,
      totalDuration: 0,
    };

    if (this.executionHistory.length > 0) {
      stats.totalDuration = this.executionHistory.reduce((sum, r) => sum + r.duration, 0);
      stats.averageDuration = stats.totalDuration / this.executionHistory.length;
    }

    return stats;
  }

  clearHistory(): void {
    this.executionHistory = [];
  }
}

export const toolRunner = new ToolRunner();
