// Agent Types
export interface Agent {
  id: string
  name: string
  description: string
  avatar?: string
  color: string
  /** Personality ID (string) or full AgentPersonality when creating/editing */
  personality?: string | AgentPersonality
  /** Agent type for spawn (e.g. recon-scout, exploit-dev). Used in create flow. */
  type?: string
  status: 'spawned' | 'initializing' | 'heartbeat' | 'working' | 'handoff' | 'reporting' | 'stopped' | 'online' | 'busy' | 'offline' | 'error' | 'running' | 'idle'
  codename: string
  containerId?: string
  currentTask: string
  toolsCount: number
  findingsCount: number
  capabilities: string[]
  tools: Tool[]
  mcps: MCP[]
  memory?: Memory
  config: AgentConfig
  createdAt: string
  updatedAt: string
}

export interface AgentPersonality {
  id: string
  name?: string
  description?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  topP?: number
}

export interface AgentConfig {
  model: string
  temperature: number
  maxTokens: number
  thinking?: 'adaptive' | 'enabled' | 'disabled'
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  // Custom agent config
  docker_image?: string
  system_prompt?: string
  memory_mb?: number
  cpu_count?: number
  [key: string]: unknown
}

// Message Types
export interface Message {
  id: string
  agentId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | MessageContent[]
  timestamp: string
  metadata?: MessageMetadata
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  parentId?: string
}

export interface MessageContent {
  type: 'text' | 'image' | 'file' | 'thinking'
  text?: string
  url?: string
  mimeType?: string
  data?: string
}

export interface MessageMetadata {
  tokens?: number
  latency?: number
  model?: string
  reasoning?: string
  source?: string
}

// Tool Types
export interface Tool {
  id: string
  name: string
  description: string
  type: 'builtin' | 'mcp' | 'docker' | 'custom'
  category?: string
  schema: ToolSchema
  enabled: boolean
  config?: Record<string, unknown>
}

export interface ToolSchema {
  type: 'object'
  properties: Record<string, ToolProperty>
  required?: string[]
}

export interface ToolProperty {
  type: string
  description: string
  enum?: string[]
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  toolCallId: string
  content: string
  isError?: boolean
}

// MCP Types
export interface MCP {
  id: string
  name: string
  description: string
  url: string
  status: 'connected' | 'disconnected' | 'error'
  tools: Tool[]
  resources: MCPResource[]
  prompts: MCPPrompt[]
  config?: Record<string, unknown>
}

export interface MCPResource {
  uri: string
  name: string
  mimeType?: string
  description?: string
}

export interface MCPPrompt {
  name: string
  description: string
  arguments?: MCPPromptArgument[]
}

export interface MCPPromptArgument {
  name: string
  description: string
  required?: boolean
}

// Docker Types
export interface DockerContainer {
  id: string
  name: string
  image: string
  status: 'running' | 'paused' | 'exited' | 'created'
  state?: string
  ports: PortMapping[]
  mounts: VolumeMount[]
  env: Record<string, string>
  labels: Record<string, string>
  cpuUsage?: number
  memoryUsage?: number
  memoryLimit?: number
  networkStats?: NetworkStats
  createdAt: string
  startedAt?: string
}

export interface PortMapping {
  privatePort: number
  publicPort?: number
  type: string
}

export interface VolumeMount {
  source: string
  destination: string
  mode: string
}

export interface NetworkStats {
  rxBytes: number
  txBytes: number
  rxPackets: number
  txPackets: number
}

export interface DockerImage {
  id: string
  name: string
  tags: string[]
  size: number
  createdAt: string
}

// Browser Types
export interface BrowserSession {
  id: string
  name: string
  url: string
  status: 'active' | 'inactive' | 'error'
  viewport: { width: number; height: number }
  screenshot?: string
  devtoolsOpen: boolean
  consoleLogs: ConsoleLog[]
  networkRequests: NetworkRequest[]
  createdAt: string
}

export interface ConsoleLog {
  level: 'log' | 'warn' | 'error' | 'info'
  message: string
  timestamp: string
  source?: string
}

export interface NetworkRequest {
  id: string
  url: string
  method: string
  status?: number
  type: string
  size?: number
  time?: number
  timestamp: string
}

// Workflow Types
export interface Workflow {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  status: 'draft' | 'running' | 'paused' | 'completed' | 'error'
  config: WorkflowConfig
  createdAt: string
  updatedAt: string
}

export interface WorkflowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  type?: string
  animated?: boolean
}

export interface WorkflowConfig {
  autoStart: boolean
  retryOnError: boolean
  maxRetries: number
  timeout: number
  parallelExecution: boolean
}

// Memory Types
export interface Memory {
  id: string
  agentId: string
  type: 'long_term' | 'short_term' | 'episodic'
  content: string
  embedding?: number[]
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// Chat Types
export interface ChatSession {
  id: string
  name: string
  agentId: string
  messages: Message[]
  context?: string
  mode: 'chat' | 'research' | 'bug_bounty' | 'custom'
  status: 'active' | 'archived'
  createdAt: string
  updatedAt: string
}

// Settings Types
export interface NotificationSettings {
  agentCompletion: boolean
  workflowStatus: boolean
  containerEvents: boolean
  securityFindings: boolean
}

export interface SecuritySettings {
  rateLimiting: boolean
  corsProtection: boolean
  auditLogging: boolean
  sslEnforcement: boolean
  intrusionDetection: boolean
}

export interface AdvancedSettings {
  debugMode: boolean
  telemetry: boolean
}

export interface AppSettings {
  theme: 'dark'
  language: string
  notifications: boolean
  autoSave: boolean
  modelDefaults: AgentConfig
  dockerDefaults: DockerDefaults
  mcpDefaults: MCPDefaults
  notificationSettings: NotificationSettings
  securitySettings: SecuritySettings
  advancedSettings: AdvancedSettings
}

export interface DockerDefaults {
  defaultImage: string
  pentestImage: string
  autoCleanup: boolean
  resourceLimits: ResourceLimits
}

export interface ResourceLimits {
  cpu: number
  memory: number
  swap: number
}

export interface MCPDefaults {
  autoConnect: boolean
  timeout: number
  retryAttempts: number
}

// API Types
export interface APIResponse<T> {
  success: boolean
  data?: T
  error?: APIError
  meta?: APIMeta
}

export interface APIError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface APIMeta {
  total?: number
  page?: number
  perPage?: number
  timestamp: string
}

// WebSocket Types
export interface WSMessage {
  type: string
  payload: unknown
  timestamp: string
  agentId?: string
}

export interface ContainerLog {
  containerId: string
  stream: 'stdout' | 'stderr'
  message: string
  timestamp: string
}

// Bug Bounty Types
export interface BugBountyTarget {
  id: string
  name: string
  url: string
  scope: string[]
  outOfScope: string[]
  status: 'discovering' | 'scanning' | 'testing' | 'reporting' | 'complete'
  findings: Finding[]
  config: BugBountyConfig
}

export interface BugBountyConfig {
  intensity: 'low' | 'medium' | 'high'
  tools: string[]
  wordlists: string[]
  threads: number
}

export interface Finding {
  id: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  type: string
  description: string
  evidence: string[]
  remediation?: string
  status: 'open' | 'fixed' | 'verified'
  cvss?: number
  createdAt: string
}
