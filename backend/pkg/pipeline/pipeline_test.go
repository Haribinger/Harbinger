package pipeline

import (
	"context"
	"strings"
	"testing"
)

func TestPipelineCreation(t *testing.T) {
	mgr := NewManager(nil)
	ctx := context.Background()

	p, err := mgr.CreatePipeline(ctx, CreatePipelineRequest{
		Name:    "recon-full",
		AgentID: "pathfinder-01",
		Input:   "example.com",
		Config:  map[string]any{"depth": 3},
	})
	if err != nil {
		t.Fatalf("CreatePipeline failed: %v", err)
	}

	if p.ID == "" {
		t.Fatal("expected non-empty pipeline ID")
	}
	if !strings.HasPrefix(p.ID, "pipe-") {
		t.Fatalf("expected ID prefix 'pipe-', got %s", p.ID)
	}
	if p.Status != StatusCreated {
		t.Fatalf("expected status %q, got %q", StatusCreated, p.Status)
	}
	if p.Name != "recon-full" {
		t.Fatalf("expected name 'recon-full', got %q", p.Name)
	}
	if p.CompletedAt != nil {
		t.Fatal("expected CompletedAt to be nil on creation")
	}

	// Verify retrieval
	got, err := mgr.GetPipeline(ctx, p.ID)
	if err != nil {
		t.Fatalf("GetPipeline failed: %v", err)
	}
	if got.ID != p.ID {
		t.Fatalf("GetPipeline returned wrong pipeline: got %s, want %s", got.ID, p.ID)
	}
}

func TestPipelineTaskFlow(t *testing.T) {
	mgr := NewManager(nil)
	ctx := context.Background()

	// Create pipeline
	p, err := mgr.CreatePipeline(ctx, CreatePipelineRequest{
		Name:    "web-audit",
		AgentID: "breach-01",
		Input:   "target.com",
	})
	if err != nil {
		t.Fatalf("CreatePipeline failed: %v", err)
	}

	// Add two tasks
	t1, err := mgr.AddTask(ctx, p.ID, AddTaskRequest{
		Title:     "subdomain enum",
		AgentType: "recon",
		Input:     "target.com",
	})
	if err != nil {
		t.Fatalf("AddTask 1 failed: %v", err)
	}

	t2, err := mgr.AddTask(ctx, p.ID, AddTaskRequest{
		Title:     "vuln scan",
		AgentType: "web-hacker",
		Input:     "target.com",
	})
	if err != nil {
		t.Fatalf("AddTask 2 failed: %v", err)
	}

	// Verify sequence numbers
	if t1.SequenceNum != 0 {
		t.Fatalf("expected task 1 sequence_num=0, got %d", t1.SequenceNum)
	}
	if t2.SequenceNum != 1 {
		t.Fatalf("expected task 2 sequence_num=1, got %d", t2.SequenceNum)
	}

	// Verify list returns tasks sorted by sequence
	tasks, err := mgr.ListTasks(ctx, p.ID)
	if err != nil {
		t.Fatalf("ListTasks failed: %v", err)
	}
	if len(tasks) != 2 {
		t.Fatalf("expected 2 tasks, got %d", len(tasks))
	}
	if tasks[0].SequenceNum != 0 || tasks[1].SequenceNum != 1 {
		t.Fatal("tasks not sorted by sequence number")
	}

	// Update statuses
	if err := mgr.UpdateTaskStatus(ctx, t1.ID, StatusRunning); err != nil {
		t.Fatalf("UpdateTaskStatus failed: %v", err)
	}
	got, err := mgr.GetTask(ctx, t1.ID)
	if err != nil {
		t.Fatalf("GetTask failed: %v", err)
	}
	if got.Status != StatusRunning {
		t.Fatalf("expected task status %q, got %q", StatusRunning, got.Status)
	}

	// Update pipeline to finished — should set CompletedAt
	if err := mgr.UpdatePipelineStatus(ctx, p.ID, StatusFinished); err != nil {
		t.Fatalf("UpdatePipelineStatus failed: %v", err)
	}
	pDone, err := mgr.GetPipeline(ctx, p.ID)
	if err != nil {
		t.Fatalf("GetPipeline failed: %v", err)
	}
	if pDone.Status != StatusFinished {
		t.Fatalf("expected pipeline status %q, got %q", StatusFinished, pDone.Status)
	}
	if pDone.CompletedAt == nil {
		t.Fatal("expected CompletedAt to be set after finishing")
	}
}
