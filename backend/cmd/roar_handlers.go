package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/Haribinger/Harbinger/backend/pkg/roar"
)

// Global ROAR protocol infrastructure — initialized by initROAR in main.
var (
	roarBus        *roar.Bus
	agentDirectory *roar.Directory
	roarEventBus   *roar.EventBus
)

// initROAR bootstraps the ROAR message bus, agent directory, and event bus.
// Registers all 11 Harbinger agents into the directory on startup.
func initROAR(c Config) {
	secret := os.Getenv("ROAR_SECRET")
	if secret == "" {
		secret = "harbinger-roar-default"
	}

	roarBus = roar.NewBus(roar.BusConfig{
		Secret:     secret,
		BufferSize: 200,
	})

	agentDirectory = roar.NewDirectory()
	roarEventBus = roar.NewEventBus(1000)

	// Harbinger's 11 core agents
	harbingerAgents := []struct {
		name      string
		agentType string
		caps      []string
	}{
		{"PATHFINDER", "agent", []string{"recon", "scanning", "enumeration"}},
		{"BREACH", "agent", []string{"web-hacking", "exploitation", "fuzzing"}},
		{"PHANTOM", "agent", []string{"cloud-security", "aws", "azure", "gcp"}},
		{"SPECTER", "agent", []string{"osint", "social-engineering", "reconnaissance"}},
		{"CIPHER", "agent", []string{"binary-analysis", "reverse-engineering", "malware"}},
		{"SCRIBE", "agent", []string{"reporting", "documentation", "compliance"}},
		{"SAM", "agent", []string{"coding", "automation", "scripting"}},
		{"BRIEF", "agent", []string{"briefing", "summary", "daily-report"}},
		{"SAGE", "agent", []string{"learning", "training", "knowledge-base"}},
		{"LENS", "agent", []string{"browser", "screenshots", "dom-interaction"}},
		{"MAINTAINER", "agent", []string{"devops", "ci-cd", "health-checks"}},
	}

	for _, a := range harbingerAgents {
		identity := roar.AgentIdentity{
			DisplayName:  a.name,
			AgentType:    a.agentType,
			Capabilities: a.caps,
		}
		roar.GenerateDID(&identity)

		card := roar.AgentCard{
			Identity:    identity,
			Description: fmt.Sprintf("Harbinger %s agent", a.name),
			Skills:      a.caps,
			Channels:    []string{"roar"},
		}
		agentDirectory.Register(card)
	}

	log.Printf("[ROAR] initialized — %d agents registered", len(harbingerAgents))
}

// handleROARPublish accepts a ROAR message and publishes it to the bus.
// POST /api/roar/message
func handleROARPublish(w http.ResponseWriter, r *http.Request) {
	if roarBus == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	var msg roar.ROARMessage
	if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	// Auto-fill ID and timestamp when missing
	if msg.ID == "" {
		msg.ID = roar.NewMessageID()
	}
	if msg.Timestamp == 0 {
		msg.Timestamp = float64(time.Now().Unix())
	}

	delivered, err := roarBus.Publish(&msg)
	if err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	// Also emit as a stream event for SSE subscribers
	if roarEventBus != nil {
		roarEventBus.Emit(roar.StreamEvent{
			Type:   roar.EventMessage,
			Source: msg.From.DID,
			Data: map[string]any{
				"message_id": msg.ID,
				"intent":     string(msg.Intent),
			},
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "delivered": delivered})
}

// handleROARAgents lists all agents registered in the ROAR directory.
// GET /api/roar/agents
func handleROARAgents(w http.ResponseWriter, r *http.Request) {
	if agentDirectory == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	entries := agentDirectory.ListAll()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "agents": entries})
}

// handleROARLookup returns a single agent by DID.
// GET /api/roar/lookup?did=did:roar:agent:pathfinder-abcdef1234567890
func handleROARLookup(w http.ResponseWriter, r *http.Request) {
	if agentDirectory == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	did := r.URL.Query().Get("did")
	if did == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "missing did query parameter"})
		return
	}

	entry := agentDirectory.Lookup(did)
	if entry == nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "agent not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "agent": entry})
}

// handleROARSearch finds agents by capability.
// GET /api/roar/search?capability=recon
func handleROARSearch(w http.ResponseWriter, r *http.Request) {
	if agentDirectory == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	capability := r.URL.Query().Get("capability")
	if capability == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "missing capability query parameter"})
		return
	}

	entries := agentDirectory.Search(capability)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "agents": entries})
}

// handleROARSubscribe streams ROAR events over SSE.
// GET /api/roar/events?type=message&source=did:roar:agent:...
func handleROARSubscribe(w http.ResponseWriter, r *http.Request) {
	if roarEventBus == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": "streaming not supported"})
		return
	}

	// Build filter from query params
	filter := roar.StreamFilter{}
	if typeParam := r.URL.Query().Get("type"); typeParam != "" {
		filter.EventTypes = []roar.StreamEventType{roar.StreamEventType(typeParam)}
	}
	if sourceParam := r.URL.Query().Get("source"); sourceParam != "" {
		filter.SourceDIDs = []string{sourceParam}
	}
	if sessionParam := r.URL.Query().Get("session"); sessionParam != "" {
		filter.SessionIDs = []string{sessionParam}
	}

	sub := roarEventBus.Subscribe(filter, 100, false)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	flusher.Flush()

	ctx := r.Context()
	defer roarEventBus.Unsubscribe(sub.ID)

	for {
		select {
		case <-ctx.Done():
			return
		case evt, ok := <-sub.Ch:
			if !ok {
				return
			}
			data, err := json.Marshal(evt)
			if err != nil {
				log.Printf("[ROAR] SSE marshal error: %v", err)
				continue
			}
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}
