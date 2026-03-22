package roar

import "time"

// MessageIntent represents the purpose of a ROAR protocol message.
type MessageIntent string

const (
	IntentExecute  MessageIntent = "execute"
	IntentDelegate MessageIntent = "delegate"
	IntentUpdate   MessageIntent = "update"
	IntentAsk      MessageIntent = "ask"
	IntentRespond  MessageIntent = "respond"
	IntentNotify   MessageIntent = "notify"
	IntentDiscover MessageIntent = "discover"
)

// AgentIdentity uniquely identifies an agent in the ROAR network.
type AgentIdentity struct {
	DID          string   `json:"did"`
	DisplayName  string   `json:"display_name"`
	AgentType    string   `json:"agent_type"`
	Capabilities []string `json:"capabilities"`
	Version      string   `json:"version"`
	PublicKey    string   `json:"public_key,omitempty"`
}

// AgentCapability describes a single capability an agent can perform.
type AgentCapability struct {
	Name         string         `json:"name"`
	Description  string         `json:"description"`
	InputSchema  map[string]any `json:"input_schema,omitempty"`
	OutputSchema map[string]any `json:"output_schema,omitempty"`
}

// AgentCard is the public profile an agent advertises for discovery.
type AgentCard struct {
	Identity             AgentIdentity     `json:"identity"`
	Description          string            `json:"description"`
	Skills               []string          `json:"skills"`
	Channels             []string          `json:"channels"`
	Endpoints            map[string]string `json:"endpoints,omitempty"`
	DeclaredCapabilities []AgentCapability `json:"declared_capabilities,omitempty"`
	Metadata             map[string]any    `json:"metadata,omitempty"`
}

// ROARMessage is the wire-format envelope for all agent communication.
type ROARMessage struct {
	ROAR      string         `json:"roar"`
	ID        string         `json:"id"`
	From      AgentIdentity  `json:"from"`
	To        AgentIdentity  `json:"to"`
	Intent    MessageIntent  `json:"intent"`
	Payload   map[string]any `json:"payload"`
	Context   map[string]any `json:"context,omitempty"`
	Auth      map[string]any `json:"auth,omitempty"`
	Timestamp float64        `json:"timestamp"`
}

// StreamEventType categorizes real-time stream events.
type StreamEventType string

const (
	EventToolCall     StreamEventType = "tool_call"
	EventMCPRequest   StreamEventType = "mcp_request"
	EventReasoning    StreamEventType = "reasoning"
	EventTaskUpdate   StreamEventType = "task_update"
	EventMonitorAlert StreamEventType = "monitor_alert"
	EventAgentStatus  StreamEventType = "agent_status"
	EventCheckpoint   StreamEventType = "checkpoint"
	EventMessage      StreamEventType = "message"
)

// StreamEvent represents a single event in a real-time agent stream.
type StreamEvent struct {
	Type      StreamEventType `json:"type"`
	Source    string          `json:"source"`
	SessionID string         `json:"session_id"`
	Data      map[string]any `json:"data"`
	Timestamp float64        `json:"timestamp"`
}

// DiscoveryEntry wraps an AgentCard with registration metadata.
type DiscoveryEntry struct {
	Card         AgentCard `json:"card"`
	RegisteredAt time.Time `json:"registered_at"`
	LastSeen     time.Time `json:"last_seen"`
}
