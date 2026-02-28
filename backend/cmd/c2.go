package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ---- C2 Infrastructure Types ----

type C2Framework struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Type        string            `json:"type"` // mythic, sliver, havoc, cobalt_strike, custom
	URL         string            `json:"url"`
	APIKey      string            `json:"apiKey,omitempty"`
	Status      string            `json:"status"` // connected, disconnected, error
	Version     string            `json:"version,omitempty"`
	Listeners   []C2Listener      `json:"listeners"`
	ImplantCount int              `json:"implantCount"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	CreatedAt   string            `json:"createdAt"`
	LastSeen    string            `json:"lastSeen,omitempty"`
}

type C2Listener struct {
	ID          string `json:"id"`
	FrameworkID string `json:"frameworkId"`
	Name        string `json:"name"`
	Type        string `json:"type"` // http, https, tcp, smb, dns, named_pipe, websocket
	BindAddress string `json:"bindAddress"`
	BindPort    int    `json:"bindPort"`
	Status      string `json:"status"` // active, stopped, error
	Protocol    string `json:"protocol,omitempty"`
	Profile     string `json:"profile,omitempty"` // C2 profile name
	CreatedAt   string `json:"createdAt"`
}

type C2Payload struct {
	ID          string   `json:"id"`
	FrameworkID string   `json:"frameworkId"`
	Name        string   `json:"name"`
	Type        string   `json:"type"`     // exe, dll, shellcode, ps1, hta, msi, office_macro, iso
	Platform    string   `json:"platform"` // windows, linux, macos, cross
	Arch        string   `json:"arch"`     // x64, x86, arm64
	Format      string   `json:"format"`   // raw, base64, hex, csharp, python
	ListenerID  string   `json:"listenerId"`
	Size        int64    `json:"size"`
	Hash        string   `json:"hash,omitempty"`
	Evasion     []string `json:"evasion,omitempty"` // amsi_bypass, etw_patch, unhook_ntdll, syscalls
	Status      string   `json:"status"` // generating, ready, error
	CreatedAt   string   `json:"createdAt"`
}

type C2Implant struct {
	ID          string   `json:"id"`
	FrameworkID string   `json:"frameworkId"`
	Hostname    string   `json:"hostname"`
	Username    string   `json:"username"`
	IP          string   `json:"ip"`
	ExternalIP  string   `json:"externalIp,omitempty"`
	OS          string   `json:"os"`
	Arch        string   `json:"arch"`
	PID         int      `json:"pid"`
	Process     string   `json:"process"`
	Integrity   string   `json:"integrity"` // system, high, medium, low
	Status      string   `json:"status"`    // active, dormant, dead, initializing
	Sleep       int      `json:"sleep"`     // seconds
	Jitter      int      `json:"jitter"`    // percent
	LastCheckIn string   `json:"lastCheckIn"`
	FirstSeen   string   `json:"firstSeen"`
	Tags        []string `json:"tags,omitempty"`
}

type C2Task struct {
	ID          string `json:"id"`
	ImplantID   string `json:"implantId"`
	Command     string `json:"command"`
	Args        string `json:"args,omitempty"`
	Status      string `json:"status"` // queued, dispatched, running, completed, failed
	Output      string `json:"output,omitempty"`
	Error       string `json:"error,omitempty"`
	Operator    string `json:"operator"`
	IssuedAt    string `json:"issuedAt"`
	CompletedAt string `json:"completedAt,omitempty"`
}

type C2Operation struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Description   string   `json:"description,omitempty"`
	Status        string   `json:"status"` // planning, active, paused, completed
	Objective     string   `json:"objective,omitempty"`
	FrameworkIDs  []string `json:"frameworkIds"`
	AgentIDs      []string `json:"agentIds"` // AI agent IDs assigned
	MitreTactics  []string `json:"mitreTactics,omitempty"`
	StartedAt     string   `json:"startedAt"`
	CompletedAt   string   `json:"completedAt,omitempty"`
}

type C2AttackChain struct {
	ID          string             `json:"id"`
	OperationID string             `json:"operationId"`
	Name        string             `json:"name"`
	Steps       []C2AttackStep     `json:"steps"`
	Status      string             `json:"status"` // pending, running, completed, failed
	CreatedAt   string             `json:"createdAt"`
}

type C2AttackStep struct {
	ID          string   `json:"id"`
	Order       int      `json:"order"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Type        string   `json:"type"` // lolbin, c2_command, script, manual
	Command     string   `json:"command,omitempty"`
	LOLEntryID  string   `json:"lolEntryId,omitempty"` // links to LOL catalog
	MitreID     string   `json:"mitreId,omitempty"`
	Status      string   `json:"status"` // pending, running, completed, failed, skipped
	Output      string   `json:"output,omitempty"`
	ImplantID   string   `json:"implantId,omitempty"`
}

type C2Dashboard struct {
	Frameworks    int                `json:"frameworks"`
	Listeners     int                `json:"listeners"`
	ActiveImplants int               `json:"activeImplants"`
	TotalTasks    int                `json:"totalTasks"`
	Operations    int                `json:"operations"`
	AttackChains  int                `json:"attackChains"`
	ByFramework   map[string]int     `json:"byFramework"`
	ByPlatform    map[string]int     `json:"byPlatform"`
	RecentTasks   []C2Task           `json:"recentTasks"`
}

// ---- In-Memory Store ----

var c2Store = struct {
	sync.RWMutex
	frameworks  map[string]C2Framework
	listeners   map[string]C2Listener
	payloads    map[string]C2Payload
	c2implants  map[string]C2Implant
	tasks       map[string]C2Task
	operations  map[string]C2Operation
	chains      map[string]C2AttackChain
}{
	frameworks: make(map[string]C2Framework),
	listeners:  make(map[string]C2Listener),
	payloads:   make(map[string]C2Payload),
	c2implants: make(map[string]C2Implant),
	tasks:      make(map[string]C2Task),
	operations: make(map[string]C2Operation),
	chains:     make(map[string]C2AttackChain),
}

func genC2ID(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixMicro())
}

// ---- Framework Handlers ----

func handleC2Dashboard(w http.ResponseWriter, r *http.Request) {
	c2Store.RLock()
	defer c2Store.RUnlock()

	activeImplants := 0
	byFramework := make(map[string]int)
	byPlatform := make(map[string]int)
	for _, imp := range c2Store.c2implants {
		if imp.Status == "active" {
			activeImplants++
		}
		byFramework[imp.FrameworkID]++
		byPlatform[imp.OS]++
	}

	listenerCount := 0
	for _, l := range c2Store.listeners {
		if l.Status == "active" {
			listenerCount++
		}
	}

	recentTasks := make([]C2Task, 0)
	for _, t := range c2Store.tasks {
		recentTasks = append(recentTasks, t)
		if len(recentTasks) >= 20 {
			break
		}
	}

	dash := C2Dashboard{
		Frameworks:     len(c2Store.frameworks),
		Listeners:      listenerCount,
		ActiveImplants: activeImplants,
		TotalTasks:     len(c2Store.tasks),
		Operations:     len(c2Store.operations),
		AttackChains:   len(c2Store.chains),
		ByFramework:    byFramework,
		ByPlatform:     byPlatform,
		RecentTasks:    recentTasks,
	}

	writeJSON(w, http.StatusOK, dash)
}

func handleListC2Frameworks(w http.ResponseWriter, r *http.Request) {
	c2Store.RLock()
	defer c2Store.RUnlock()

	items := make([]C2Framework, 0, len(c2Store.frameworks))
	for _, fw := range c2Store.frameworks {
		// strip API key from list response
		fw.APIKey = ""
		items = append(items, fw)
	}
	writeJSON(w, http.StatusOK, items)
}

func handleCreateC2Framework(w http.ResponseWriter, r *http.Request) {
	var fw C2Framework
	if err := json.NewDecoder(r.Body).Decode(&fw); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "invalid body"})
		return
	}

	validTypes := map[string]bool{"mythic": true, "sliver": true, "havoc": true, "cobalt_strike": true, "custom": true}
	if !validTypes[fw.Type] {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "invalid framework type"})
		return
	}

	fw.ID = genC2ID("fw")
	fw.CreatedAt = time.Now().Format(time.RFC3339)
	fw.Status = "disconnected"
	if fw.Listeners == nil {
		fw.Listeners = []C2Listener{}
	}

	c2Store.Lock()
	c2Store.frameworks[fw.ID] = fw
	c2Store.Unlock()

	fw.APIKey = "" // don't return key
	writeJSON(w, http.StatusCreated, map[string]interface{}{"ok": true, "framework": fw})
}

func handleGetC2Framework(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	c2Store.RLock()
	fw, ok := c2Store.frameworks[id]
	c2Store.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": "framework not found"})
		return
	}
	fw.APIKey = ""
	writeJSON(w, http.StatusOK, fw)
}

func handleDeleteC2Framework(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	c2Store.Lock()
	if _, ok := c2Store.frameworks[id]; !ok {
		c2Store.Unlock()
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": "framework not found"})
		return
	}
	delete(c2Store.frameworks, id)
	c2Store.Unlock()

	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
}

func handleConnectC2Framework(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	c2Store.Lock()
	fw, ok := c2Store.frameworks[id]
	if !ok {
		c2Store.Unlock()
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": "framework not found"})
		return
	}
	fw.Status = "connected"
	fw.LastSeen = time.Now().Format(time.RFC3339)
	c2Store.frameworks[id] = fw
	c2Store.Unlock()

	fw.APIKey = ""
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "framework": fw})
}

// ---- Listener Handlers ----

func handleListC2Listeners(w http.ResponseWriter, r *http.Request) {
	frameworkID := r.URL.Query().Get("frameworkId")

	c2Store.RLock()
	defer c2Store.RUnlock()

	items := make([]C2Listener, 0)
	for _, l := range c2Store.listeners {
		if frameworkID == "" || l.FrameworkID == frameworkID {
			items = append(items, l)
		}
	}
	writeJSON(w, http.StatusOK, items)
}

func handleCreateC2Listener(w http.ResponseWriter, r *http.Request) {
	var l C2Listener
	if err := json.NewDecoder(r.Body).Decode(&l); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "invalid body"})
		return
	}

	l.ID = genC2ID("lsn")
	l.CreatedAt = time.Now().Format(time.RFC3339)
	if l.Status == "" {
		l.Status = "active"
	}

	c2Store.Lock()
	c2Store.listeners[l.ID] = l
	c2Store.Unlock()

	writeJSON(w, http.StatusCreated, map[string]interface{}{"ok": true, "listener": l})
}

func handleDeleteC2Listener(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	c2Store.Lock()
	if _, ok := c2Store.listeners[id]; !ok {
		c2Store.Unlock()
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": "listener not found"})
		return
	}
	delete(c2Store.listeners, id)
	c2Store.Unlock()

	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
}

// ---- Payload Handlers ----

func handleListC2Payloads(w http.ResponseWriter, r *http.Request) {
	frameworkID := r.URL.Query().Get("frameworkId")

	c2Store.RLock()
	defer c2Store.RUnlock()

	items := make([]C2Payload, 0)
	for _, p := range c2Store.payloads {
		if frameworkID == "" || p.FrameworkID == frameworkID {
			items = append(items, p)
		}
	}
	writeJSON(w, http.StatusOK, items)
}

func handleCreateC2Payload(w http.ResponseWriter, r *http.Request) {
	var p C2Payload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "invalid body"})
		return
	}

	p.ID = genC2ID("pld")
	p.CreatedAt = time.Now().Format(time.RFC3339)
	p.Status = "ready"
	if p.Evasion == nil {
		p.Evasion = []string{}
	}

	c2Store.Lock()
	c2Store.payloads[p.ID] = p
	c2Store.Unlock()

	writeJSON(w, http.StatusCreated, map[string]interface{}{"ok": true, "payload": p})
}

// ---- Implant Handlers ----

func handleListC2Implants(w http.ResponseWriter, r *http.Request) {
	frameworkID := r.URL.Query().Get("frameworkId")
	status := r.URL.Query().Get("status")

	c2Store.RLock()
	defer c2Store.RUnlock()

	items := make([]C2Implant, 0)
	for _, imp := range c2Store.c2implants {
		if frameworkID != "" && imp.FrameworkID != frameworkID {
			continue
		}
		if status != "" && imp.Status != status {
			continue
		}
		items = append(items, imp)
	}
	writeJSON(w, http.StatusOK, items)
}

func handleCreateC2Implant(w http.ResponseWriter, r *http.Request) {
	var imp C2Implant
	if err := json.NewDecoder(r.Body).Decode(&imp); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "invalid body"})
		return
	}

	imp.ID = genC2ID("imp")
	imp.FirstSeen = time.Now().Format(time.RFC3339)
	imp.LastCheckIn = time.Now().Format(time.RFC3339)
	if imp.Status == "" {
		imp.Status = "active"
	}
	if imp.Tags == nil {
		imp.Tags = []string{}
	}

	c2Store.Lock()
	c2Store.c2implants[imp.ID] = imp
	c2Store.Unlock()

	writeJSON(w, http.StatusCreated, map[string]interface{}{"ok": true, "implant": imp})
}

func handleGetC2Implant(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	c2Store.RLock()
	imp, ok := c2Store.c2implants[id]
	c2Store.RUnlock()

	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": "implant not found"})
		return
	}
	writeJSON(w, http.StatusOK, imp)
}

func handleKillC2Implant(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	c2Store.Lock()
	imp, ok := c2Store.c2implants[id]
	if !ok {
		c2Store.Unlock()
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": "implant not found"})
		return
	}
	imp.Status = "dead"
	c2Store.c2implants[id] = imp
	c2Store.Unlock()

	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
}

// ---- Task Handlers ----

func handleListC2Tasks(w http.ResponseWriter, r *http.Request) {
	implantID := r.URL.Query().Get("implantId")

	c2Store.RLock()
	defer c2Store.RUnlock()

	items := make([]C2Task, 0)
	for _, t := range c2Store.tasks {
		if implantID == "" || t.ImplantID == implantID {
			items = append(items, t)
		}
	}
	writeJSON(w, http.StatusOK, items)
}

func handleCreateC2Task(w http.ResponseWriter, r *http.Request) {
	var t C2Task
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "invalid body"})
		return
	}

	t.ID = genC2ID("task")
	t.IssuedAt = time.Now().Format(time.RFC3339)
	if t.Status == "" {
		t.Status = "queued"
	}

	c2Store.Lock()
	c2Store.tasks[t.ID] = t
	c2Store.Unlock()

	writeJSON(w, http.StatusCreated, map[string]interface{}{"ok": true, "task": t})
}

func handleCompleteC2Task(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var body struct {
		Output string `json:"output"`
		Error  string `json:"error"`
		Status string `json:"status"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	c2Store.Lock()
	t, ok := c2Store.tasks[id]
	if !ok {
		c2Store.Unlock()
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": "task not found"})
		return
	}
	t.Output = body.Output
	t.Error = body.Error
	t.CompletedAt = time.Now().Format(time.RFC3339)
	if body.Status != "" {
		t.Status = body.Status
	} else {
		t.Status = "completed"
	}
	c2Store.tasks[id] = t
	c2Store.Unlock()

	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "task": t})
}

// ---- Operation Handlers ----

func handleListC2Operations(w http.ResponseWriter, r *http.Request) {
	c2Store.RLock()
	defer c2Store.RUnlock()

	items := make([]C2Operation, 0, len(c2Store.operations))
	for _, op := range c2Store.operations {
		items = append(items, op)
	}
	writeJSON(w, http.StatusOK, items)
}

func handleCreateC2Operation(w http.ResponseWriter, r *http.Request) {
	var op C2Operation
	if err := json.NewDecoder(r.Body).Decode(&op); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "invalid body"})
		return
	}

	op.ID = genC2ID("op")
	op.StartedAt = time.Now().Format(time.RFC3339)
	if op.Status == "" {
		op.Status = "planning"
	}
	if op.FrameworkIDs == nil {
		op.FrameworkIDs = []string{}
	}
	if op.AgentIDs == nil {
		op.AgentIDs = []string{}
	}
	if op.MitreTactics == nil {
		op.MitreTactics = []string{}
	}

	c2Store.Lock()
	c2Store.operations[op.ID] = op
	c2Store.Unlock()

	writeJSON(w, http.StatusCreated, map[string]interface{}{"ok": true, "operation": op})
}

func handleUpdateC2Operation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "invalid body"})
		return
	}

	c2Store.Lock()
	op, ok := c2Store.operations[id]
	if !ok {
		c2Store.Unlock()
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": "operation not found"})
		return
	}

	if s, ok := body["status"].(string); ok {
		op.Status = s
	}
	if s, ok := body["name"].(string); ok {
		op.Name = s
	}
	if s, ok := body["objective"].(string); ok {
		op.Objective = s
	}
	if op.Status == "completed" && op.CompletedAt == "" {
		op.CompletedAt = time.Now().Format(time.RFC3339)
	}
	c2Store.operations[id] = op
	c2Store.Unlock()

	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "operation": op})
}

// ---- Attack Chain Handlers ----

func handleListC2AttackChains(w http.ResponseWriter, r *http.Request) {
	opID := r.URL.Query().Get("operationId")

	c2Store.RLock()
	defer c2Store.RUnlock()

	items := make([]C2AttackChain, 0)
	for _, ch := range c2Store.chains {
		if opID == "" || ch.OperationID == opID {
			items = append(items, ch)
		}
	}
	writeJSON(w, http.StatusOK, items)
}

func handleCreateC2AttackChain(w http.ResponseWriter, r *http.Request) {
	var ch C2AttackChain
	if err := json.NewDecoder(r.Body).Decode(&ch); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "invalid body"})
		return
	}

	ch.ID = genC2ID("chain")
	ch.CreatedAt = time.Now().Format(time.RFC3339)
	if ch.Status == "" {
		ch.Status = "pending"
	}
	if ch.Steps == nil {
		ch.Steps = []C2AttackStep{}
	}
	// assign step IDs
	for i := range ch.Steps {
		if ch.Steps[i].ID == "" {
			ch.Steps[i].ID = fmt.Sprintf("step-%d-%d", time.Now().UnixMicro(), i)
		}
		ch.Steps[i].Order = i + 1
		if ch.Steps[i].Status == "" {
			ch.Steps[i].Status = "pending"
		}
	}

	c2Store.Lock()
	c2Store.chains[ch.ID] = ch
	c2Store.Unlock()

	writeJSON(w, http.StatusCreated, map[string]interface{}{"ok": true, "chain": ch})
}

func handleExecuteC2AttackChain(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	c2Store.Lock()
	ch, ok := c2Store.chains[id]
	if !ok {
		c2Store.Unlock()
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": "chain not found"})
		return
	}
	ch.Status = "running"
	if len(ch.Steps) > 0 {
		ch.Steps[0].Status = "running"
	}
	c2Store.chains[id] = ch
	c2Store.Unlock()

	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "chain": ch})
}

func handleUpdateC2ChainStep(w http.ResponseWriter, r *http.Request) {
	chainID := r.PathValue("chainId")
	stepID := r.PathValue("stepId")

	var body struct {
		Status string `json:"status"`
		Output string `json:"output"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "invalid body"})
		return
	}

	c2Store.Lock()
	ch, ok := c2Store.chains[chainID]
	if !ok {
		c2Store.Unlock()
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": "chain not found"})
		return
	}

	found := false
	for i := range ch.Steps {
		if ch.Steps[i].ID == stepID {
			ch.Steps[i].Status = body.Status
			ch.Steps[i].Output = body.Output
			found = true

			// auto-advance: if step completed, start next pending step
			if body.Status == "completed" && i+1 < len(ch.Steps) {
				ch.Steps[i+1].Status = "running"
			}
			// check if all steps done
			allDone := true
			anyFailed := false
			for _, s := range ch.Steps {
				if s.Status != "completed" && s.Status != "failed" && s.Status != "skipped" {
					allDone = false
				}
				if s.Status == "failed" {
					anyFailed = true
				}
			}
			if allDone {
				if anyFailed {
					ch.Status = "failed"
				} else {
					ch.Status = "completed"
				}
			}
			break
		}
	}
	c2Store.chains[chainID] = ch
	c2Store.Unlock()

	if !found {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": "step not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "chain": ch})
}

// ---- C2 Search ----

func handleC2Search(w http.ResponseWriter, r *http.Request) {
	query := strings.ToLower(r.URL.Query().Get("q"))
	if query == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "query parameter 'q' required"})
		return
	}

	c2Store.RLock()
	defer c2Store.RUnlock()

	type searchResult struct {
		Type string      `json:"type"`
		ID   string      `json:"id"`
		Name string      `json:"name"`
		Data interface{} `json:"data"`
	}

	results := make([]searchResult, 0)

	for _, fw := range c2Store.frameworks {
		if strings.Contains(strings.ToLower(fw.Name), query) || strings.Contains(strings.ToLower(fw.Type), query) {
			results = append(results, searchResult{Type: "framework", ID: fw.ID, Name: fw.Name, Data: fw})
		}
	}
	for _, imp := range c2Store.c2implants {
		if strings.Contains(strings.ToLower(imp.Hostname), query) ||
			strings.Contains(strings.ToLower(imp.Username), query) ||
			strings.Contains(imp.IP, query) {
			results = append(results, searchResult{Type: "implant", ID: imp.ID, Name: imp.Hostname, Data: imp})
		}
	}
	for _, t := range c2Store.tasks {
		if strings.Contains(strings.ToLower(t.Command), query) ||
			strings.Contains(strings.ToLower(t.Output), query) {
			results = append(results, searchResult{Type: "task", ID: t.ID, Name: t.Command, Data: t})
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "results": results, "count": len(results)})
}
