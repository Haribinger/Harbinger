package main

import (
	"encoding/json"
	"net/http"

	"github.com/Haribinger/Harbinger/backend/pkg/pipeline"
)

// pipelineMgr is the global pipeline orchestration manager.
var pipelineMgr *pipeline.Manager

// initPipeline creates the pipeline manager using the global db connection.
// Works in pure in-memory mode when db is nil.
func initPipeline() {
	pipelineMgr = pipeline.NewManager(db)
}

// handleCreatePipeline creates a new pipeline from a JSON request body.
func handleCreatePipeline(w http.ResponseWriter, r *http.Request) {
	if pipelineMgr == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	var req pipeline.CreatePipelineRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "name is required"})
		return
	}

	p, err := pipelineMgr.CreatePipeline(r.Context(), req)
	if err != nil {
		internalError(w, "create pipeline", err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "pipeline": p})
}

// handleListPipelines returns all pipelines.
func handleListPipelines(w http.ResponseWriter, r *http.Request) {
	if pipelineMgr == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	items, err := pipelineMgr.ListPipelines(r.Context())
	if err != nil {
		internalError(w, "list pipelines", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": items})
}

// handleGetPipeline returns a single pipeline by ID.
func handleGetPipeline(w http.ResponseWriter, r *http.Request) {
	if pipelineMgr == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "pipeline id required"})
		return
	}

	p, err := pipelineMgr.GetPipeline(r.Context(), id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "pipeline": p})
}

// handleUpdatePipelineStatus transitions a pipeline to a new status.
func handleUpdatePipelineStatus(w http.ResponseWriter, r *http.Request) {
	if pipelineMgr == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "pipeline id required"})
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	if req.Status == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "status is required"})
		return
	}

	if err := pipelineMgr.UpdatePipelineStatus(r.Context(), id, pipeline.Status(req.Status)); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// handleAddPipelineTask adds a task to a pipeline.
func handleAddPipelineTask(w http.ResponseWriter, r *http.Request) {
	if pipelineMgr == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	pipelineID := r.PathValue("id")
	if pipelineID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "pipeline id required"})
		return
	}

	var req pipeline.AddTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	if req.Title == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "title is required"})
		return
	}

	t, err := pipelineMgr.AddTask(r.Context(), pipelineID, req)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "task": t})
}

// handleListPipelineTasks returns all tasks for a pipeline, sorted by sequence.
func handleListPipelineTasks(w http.ResponseWriter, r *http.Request) {
	if pipelineMgr == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	pipelineID := r.PathValue("id")
	if pipelineID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "pipeline id required"})
		return
	}

	tasks, err := pipelineMgr.ListTasks(r.Context(), pipelineID)
	if err != nil {
		internalError(w, "list pipeline tasks", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": tasks})
}
