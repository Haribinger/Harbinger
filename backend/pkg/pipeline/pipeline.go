package pipeline

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"sort"
	"sync"
	"time"
)

// Manager handles pipeline orchestration with in-memory storage.
// The db field is reserved for future PostgreSQL persistence.
type Manager struct {
	db       *sql.DB
	mu       sync.RWMutex
	pipelines map[string]*Pipeline
	tasks     map[string]*Task
	subtasks  map[string]*Subtask
}

// NewManager creates a new pipeline manager. db can be nil for in-memory-only mode.
func NewManager(db *sql.DB) *Manager {
	return &Manager{
		db:        db,
		pipelines: make(map[string]*Pipeline),
		tasks:     make(map[string]*Task),
		subtasks:  make(map[string]*Subtask),
	}
}

// generateID produces a prefixed random hex identifier (e.g. "pipe-a1b2c3d4...").
func generateID(prefix string) (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generating id: %w", err)
	}
	return prefix + "-" + hex.EncodeToString(b), nil
}

// CreatePipeline creates a new pipeline from the given request.
func (m *Manager) CreatePipeline(_ context.Context, req CreatePipelineRequest) (*Pipeline, error) {
	id, err := generateID("pipe")
	if err != nil {
		return nil, err
	}

	now := time.Now()
	p := &Pipeline{
		ID:        id,
		Name:      req.Name,
		Status:    StatusCreated,
		AgentID:   req.AgentID,
		Input:     req.Input,
		Config:    req.Config,
		CreatedAt: now,
		UpdatedAt: now,
	}

	m.mu.Lock()
	m.pipelines[id] = p
	m.mu.Unlock()

	return p, nil
}

// GetPipeline retrieves a pipeline by ID.
func (m *Manager) GetPipeline(_ context.Context, id string) (*Pipeline, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	p, ok := m.pipelines[id]
	if !ok {
		return nil, fmt.Errorf("pipeline not found: %s", id)
	}
	return p, nil
}

// ListPipelines returns all pipelines.
func (m *Manager) ListPipelines(_ context.Context) ([]*Pipeline, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*Pipeline, 0, len(m.pipelines))
	for _, p := range m.pipelines {
		result = append(result, p)
	}
	return result, nil
}

// UpdatePipelineStatus transitions a pipeline to a new status.
// Sets CompletedAt when moving to finished or failed.
func (m *Manager) UpdatePipelineStatus(_ context.Context, id string, status Status) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	p, ok := m.pipelines[id]
	if !ok {
		return fmt.Errorf("pipeline not found: %s", id)
	}

	p.Status = status
	p.UpdatedAt = time.Now()

	if status == StatusFinished || status == StatusFailed {
		now := time.Now()
		p.CompletedAt = &now
	}

	return nil
}

// AddTask adds a new task to a pipeline. SequenceNum is auto-assigned based on
// the count of existing tasks in the same pipeline.
func (m *Manager) AddTask(_ context.Context, pipelineID string, req AddTaskRequest) (*Task, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.pipelines[pipelineID]; !ok {
		return nil, fmt.Errorf("pipeline not found: %s", pipelineID)
	}

	// Count existing tasks for this pipeline to determine sequence number
	seq := 0
	for _, t := range m.tasks {
		if t.PipelineID == pipelineID {
			seq++
		}
	}

	id, err := generateID("task")
	if err != nil {
		return nil, err
	}

	now := time.Now()
	t := &Task{
		ID:          id,
		PipelineID:  pipelineID,
		Title:       req.Title,
		Status:      StatusCreated,
		Input:       req.Input,
		AgentType:   req.AgentType,
		SequenceNum: seq,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	m.tasks[id] = t
	return t, nil
}

// GetTask retrieves a task by ID.
func (m *Manager) GetTask(_ context.Context, id string) (*Task, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	t, ok := m.tasks[id]
	if !ok {
		return nil, fmt.Errorf("task not found: %s", id)
	}
	return t, nil
}

// ListTasks returns all tasks for a pipeline, sorted by SequenceNum ascending.
func (m *Manager) ListTasks(_ context.Context, pipelineID string) ([]*Task, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []*Task
	for _, t := range m.tasks {
		if t.PipelineID == pipelineID {
			result = append(result, t)
		}
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].SequenceNum < result[j].SequenceNum
	})

	return result, nil
}

// UpdateTaskStatus transitions a task to a new status.
func (m *Manager) UpdateTaskStatus(_ context.Context, id string, status Status) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	t, ok := m.tasks[id]
	if !ok {
		return fmt.Errorf("task not found: %s", id)
	}

	t.Status = status
	t.UpdatedAt = time.Now()
	return nil
}

// AddSubtask adds a new subtask to a task. PipelineID is inherited from the parent task.
func (m *Manager) AddSubtask(_ context.Context, taskID string, req AddSubtaskRequest) (*Subtask, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	task, ok := m.tasks[taskID]
	if !ok {
		return nil, fmt.Errorf("task not found: %s", taskID)
	}

	id, err := generateID("sub")
	if err != nil {
		return nil, err
	}

	now := time.Now()
	s := &Subtask{
		ID:          id,
		TaskID:      taskID,
		PipelineID:  task.PipelineID,
		Title:       req.Title,
		Description: req.Description,
		Status:      StatusCreated,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	m.subtasks[id] = s
	return s, nil
}

// ListSubtasks returns all subtasks for a given task.
func (m *Manager) ListSubtasks(_ context.Context, taskID string) ([]*Subtask, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []*Subtask
	for _, s := range m.subtasks {
		if s.TaskID == taskID {
			result = append(result, s)
		}
	}
	return result, nil
}
