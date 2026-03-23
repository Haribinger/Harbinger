package main

import (
	"crypto/rand"
	"encoding/hex"
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
	roarSecret     string // Resolved once by initROAR, used by comms bridge
)

// initROAR bootstraps the ROAR message bus, agent directory, and event bus.
// Registers all 11 Harbinger agents into the directory on startup.
func initROAR(c Config) {
	roarSecret = os.Getenv("ROAR_SECRET")
	if roarSecret == "" {
		log.Println("[SECURITY] WARNING: ROAR_SECRET not set — generating random secret for this session. Set ROAR_SECRET env var for persistent inter-agent auth.")
		b := make([]byte, 32)
		if _, err := rand.Read(b); err != nil {
			log.Fatalf("[SECURITY] FATAL: failed to generate ROAR secret: %v", err)
		}
		roarSecret = hex.EncodeToString(b)
	}

	roarBus = roar.NewBus(roar.BusConfig{
		Secret:     roarSecret,
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

// handleROARRegister registers an external agent in the ROAR directory.
// POST /api/roar/register
// Body: {"codename":"PENTAGI","display_name":"PentAGI","description":"...",
//        "capabilities":["web_exploitation","recon"],"endpoint":"http://pentagi:8080/roar",
//        "agent_type":"external"}
func handleROARRegister(w http.ResponseWriter, r *http.Request) {
	if agentDirectory == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	var req struct {
		Codename     string         `json:"codename"`
		DisplayName  string         `json:"display_name"`
		Description  string         `json:"description"`
		Capabilities []string       `json:"capabilities"`
		Endpoint     string         `json:"endpoint"`
		AgentType    string         `json:"agent_type"`
		Metadata     map[string]any `json:"metadata"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	if req.Codename == "" && req.DisplayName == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "codename or display_name required"})
		return
	}

	displayName := req.DisplayName
	if displayName == "" {
		displayName = req.Codename
	}
	agentType := req.AgentType
	if agentType == "" {
		agentType = "external"
	}

	identity := roar.AgentIdentity{
		DisplayName:  displayName,
		AgentType:    agentType,
		Capabilities: req.Capabilities,
		Version:      "1.0.0",
	}
	roar.GenerateDID(&identity)

	endpoints := make(map[string]string)
	if req.Endpoint != "" {
		endpoints["roar"] = req.Endpoint
	}

	card := roar.AgentCard{
		Identity:    identity,
		Description: req.Description,
		Skills:      req.Capabilities,
		Channels:    []string{"roar"},
		Endpoints:   endpoints,
		Metadata:    req.Metadata,
	}

	entry := agentDirectory.Register(card)

	if roarEventBus != nil {
		roarEventBus.Emit(roar.StreamEvent{
			Type:   roar.EventAgentStatus,
			Source: identity.DID,
			Data: map[string]any{
				"action":     "registered",
				"codename":   req.Codename,
				"agent_type": agentType,
			},
		})
	}

	log.Printf("[ROAR] external agent registered: %s (DID=%s)", displayName, identity.DID)

	writeJSON(w, http.StatusCreated, map[string]any{
		"ok":       true,
		"did":      identity.DID,
		"identity": identity,
		"entry":    entry,
	})
}

// handleROARUnregister removes an agent from the ROAR directory.
// DELETE /api/roar/agents/{did}
func handleROARUnregister(w http.ResponseWriter, r *http.Request) {
	if agentDirectory == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "reason": "not_configured"})
		return
	}

	did := r.PathValue("did")
	if did == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "did path parameter required"})
		return
	}

	if !agentDirectory.Unregister(did) {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "agent not found"})
		return
	}

	if roarEventBus != nil {
		roarEventBus.Emit(roar.StreamEvent{
			Type:   roar.EventAgentStatus,
			Source: did,
			Data:   map[string]any{"action": "unregistered"},
		})
	}

	log.Printf("[ROAR] agent unregistered: %s", did)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "did": did})
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
