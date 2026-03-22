package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/Haribinger/Harbinger/backend/pkg/executor"
)

// execEngine is the global Docker executor instance. Nil when Docker is unavailable.
var execEngine *executor.Executor

// initExecutor attempts to connect to Docker and create an Executor.
// Logs a warning and leaves execEngine nil if Docker is unreachable — never crashes.
func initExecutor(c Config) {
	eng, err := executor.NewExecutor(executor.ExecutorConfig{
		DockerHost:   c.DockerHost,
		DockerSocket: c.DockerSocket,
		Network:      c.DockerNetwork,
	})
	if err != nil {
		log.Printf("[WARN] Executor init skipped (Docker unavailable): %v", err)
		return
	}
	execEngine = eng
	log.Println("[INFO] Executor engine initialized")
}

// handleSpawnExecution creates and starts a new sandbox container.
func handleSpawnExecution(w http.ResponseWriter, r *http.Request) {
	if execEngine == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	var req struct {
		Name  string            `json:"name"`
		Image string            `json:"image"`
		Env   map[string]string `json:"env"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	if req.Image == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "image is required"})
		return
	}

	// Convert map env to KEY=VALUE slice
	var envSlice []string
	for k, v := range req.Env {
		envSlice = append(envSlice, k+"="+v)
	}

	container, err := execEngine.Spawn(r.Context(), executor.SpawnRequest{
		Name:  req.Name,
		Image: req.Image,
		Env:   envSlice,
	})
	if err != nil {
		internalError(w, "spawn execution", err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"ok": true,
		"container": map[string]any{
			"id":    container.ContainerID,
			"name":  container.Name,
			"image": container.Image,
		},
	})
}

// handleExecCommand runs a command inside an existing container.
func handleExecCommand(w http.ResponseWriter, r *http.Request) {
	if execEngine == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	containerID := r.PathValue("id")
	if containerID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "container id required"})
		return
	}

	var req struct {
		Command []string          `json:"command"`
		Workdir string            `json:"workdir"`
		Env     map[string]string `json:"env"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	if len(req.Command) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "command is required"})
		return
	}

	var envSlice []string
	for k, v := range req.Env {
		envSlice = append(envSlice, k+"="+v)
	}

	result, err := execEngine.Exec(r.Context(), containerID, executor.ExecRequest{
		Command: req.Command,
		WorkDir: req.Workdir,
		Env:     envSlice,
	})
	if err != nil {
		internalError(w, "exec command", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"result": map[string]any{
			"exit_code": result.ExitCode,
			"stdout":    result.Stdout,
			"stderr":    result.Stderr,
		},
	})
}

// handleStopExecution stops a running container.
func handleStopExecution(w http.ResponseWriter, r *http.Request) {
	if execEngine == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	containerID := r.PathValue("id")
	if containerID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "container id required"})
		return
	}

	if err := execEngine.Stop(r.Context(), containerID); err != nil {
		internalError(w, "stop execution", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// handleRemoveExecution force-removes a container.
func handleRemoveExecution(w http.ResponseWriter, r *http.Request) {
	if execEngine == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	containerID := r.PathValue("id")
	if containerID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "container id required"})
		return
	}

	if err := execEngine.Remove(r.Context(), containerID); err != nil {
		internalError(w, "remove execution", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
