package executor

import (
	"context"
	"strings"
	"testing"
	"time"
)

// newTestExecutor tries to connect to Docker via the default unix socket.
// If Docker is unavailable, the test is skipped.
func newTestExecutor(t *testing.T) *Executor {
	t.Helper()
	e, err := NewExecutor(ExecutorConfig{})
	if err != nil {
		t.Skipf("Docker unavailable, skipping: %v", err)
	}
	return e
}

func TestNewExecutor(t *testing.T) {
	e := newTestExecutor(t)
	if e == nil {
		t.Fatal("expected non-nil executor")
	}
	if e.config.DefaultImage != "alpine:latest" {
		t.Errorf("expected default image alpine:latest, got %s", e.config.DefaultImage)
	}
	if e.config.DockerSocket != "/var/run/docker.sock" {
		t.Errorf("expected default socket /var/run/docker.sock, got %s", e.config.DockerSocket)
	}
}

func TestExecutorSpawnAndExec(t *testing.T) {
	e := newTestExecutor(t)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// Spawn an alpine container
	c, err := e.Spawn(ctx, SpawnRequest{
		Name:  "test",
		Image: "alpine:latest",
	})
	if err != nil {
		t.Fatalf("Spawn failed: %v", err)
	}
	defer e.Cleanup(ctx)

	if c.ContainerID == "" {
		t.Fatal("expected non-empty container ID")
	}
	if c.Status != "running" {
		t.Errorf("expected status running, got %s", c.Status)
	}

	// Exec a command inside the container
	result, err := e.Exec(ctx, c.ContainerID, ExecRequest{
		Command: []string{"echo", "hello harbinger"},
	})
	if err != nil {
		t.Fatalf("Exec failed: %v", err)
	}

	if result.ExitCode != 0 {
		t.Errorf("expected exit code 0, got %d", result.ExitCode)
	}

	stdout := strings.TrimSpace(result.Stdout)
	if stdout != "hello harbinger" {
		t.Errorf("expected stdout 'hello harbinger', got %q", stdout)
	}
}
