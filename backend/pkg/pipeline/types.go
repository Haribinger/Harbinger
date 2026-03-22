package pipeline

import "time"

// Status represents the current state of a pipeline, task, or subtask.
type Status string

const (
	StatusCreated  Status = "created"
	StatusRunning  Status = "running"
	StatusWaiting  Status = "waiting"
	StatusFinished Status = "finished"
	StatusFailed   Status = "failed"
)

// Pipeline is a top-level orchestration unit that coordinates tasks for an agent.
type Pipeline struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Status      Status         `json:"status"`
	AgentID     string         `json:"agent_id"`
	Input       string         `json:"input"`
	Result      string         `json:"result"`
	Config      map[string]any `json:"config"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	CompletedAt *time.Time     `json:"completed_at"`
}

// Task is a sequential unit of work within a pipeline.
type Task struct {
	ID          string    `json:"id"`
	PipelineID  string    `json:"pipeline_id"`
	Title       string    `json:"title"`
	Status      Status    `json:"status"`
	Input       string    `json:"input"`
	Result      string    `json:"result"`
	AgentType   string    `json:"agent_type"`
	SequenceNum int       `json:"sequence_num"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Subtask is a granular work item within a task.
type Subtask struct {
	ID          string    `json:"id"`
	TaskID      string    `json:"task_id"`
	PipelineID  string    `json:"pipeline_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      Status    `json:"status"`
	Result      string    `json:"result"`
	ContainerID string    `json:"container_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CreatePipelineRequest holds the parameters for creating a new pipeline.
type CreatePipelineRequest struct {
	Name    string         `json:"name"`
	AgentID string         `json:"agent_id"`
	Input   string         `json:"input"`
	Config  map[string]any `json:"config,omitempty"`
}

// AddTaskRequest holds the parameters for adding a task to a pipeline.
type AddTaskRequest struct {
	Title     string `json:"title"`
	AgentType string `json:"agent_type"`
	Input     string `json:"input"`
}

// AddSubtaskRequest holds the parameters for adding a subtask to a task.
type AddSubtaskRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}
