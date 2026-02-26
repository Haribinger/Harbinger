package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

// db is the global database connection pool.
var db *sql.DB

// initDB connects to PostgreSQL and verifies connectivity.
// Falls back to in-memory mode if the connection fails (dev without Docker).
func initDB(c Config) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		c.DBHost, c.DBPort, c.DBUser, c.DBPass, c.DBName,
	)

	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[DB] Failed to open connection: %v — running in memory-only mode", err)
		db = nil
		return
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err = db.Ping(); err != nil {
		log.Printf("[DB] Ping failed: %v — running in memory-only mode", err)
		db = nil
		return
	}

	log.Println("[DB] PostgreSQL connected")
}

// dbAvailable returns true when we have a live database connection.
func dbAvailable() bool {
	return db != nil
}

// ============================================================================
// SESSIONS
// ============================================================================

// DBSession maps to the sessions table.
type DBSession struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	TokenHash string    `json:"token_hash"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	IsActive  bool      `json:"is_active"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

func dbCreateSession(userID, tokenHash, ip, ua string, expiresAt time.Time) (*DBSession, error) {
	if !dbAvailable() {
		return nil, fmt.Errorf("database not available")
	}
	s := &DBSession{}
	err := db.QueryRow(`
		INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at)
		VALUES ($1, $2, $3::inet, $4, $5)
		RETURNING id, user_id, token_hash, ip_address::text, user_agent, is_active, expires_at, created_at`,
		userID, tokenHash, ip, ua, expiresAt,
	).Scan(&s.ID, &s.UserID, &s.TokenHash, &s.IPAddress, &s.UserAgent, &s.IsActive, &s.ExpiresAt, &s.CreatedAt)
	return s, err
}

func dbListSessions(userID string) ([]DBSession, error) {
	if !dbAvailable() {
		return nil, fmt.Errorf("database not available")
	}
	rows, err := db.Query(`
		SELECT id, user_id, token_hash, COALESCE(ip_address::text,''), COALESCE(user_agent,''),
		       is_active, expires_at, created_at
		FROM sessions WHERE user_id = $1 AND is_active = true
		ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []DBSession
	for rows.Next() {
		var s DBSession
		if err := rows.Scan(&s.ID, &s.UserID, &s.TokenHash, &s.IPAddress, &s.UserAgent,
			&s.IsActive, &s.ExpiresAt, &s.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, nil
}

func dbRevokeSession(sessionID, userID string) error {
	if !dbAvailable() {
		return fmt.Errorf("database not available")
	}
	res, err := db.Exec(`
		UPDATE sessions SET is_active = false, revoked_at = NOW()
		WHERE id = $1 AND user_id = $2`, sessionID, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("session not found or unauthorized")
	}
	return nil
}

// ============================================================================
// AUDIT LOG
// ============================================================================

func dbAddAuditEntry(userID, action, entityType, entityID string, details map[string]any, ip string) error {
	if !dbAvailable() {
		// Fallback: append to in-memory log
		auditLog = append(auditLog, AuditLogEntry{
			ID:        generateRandomString(10),
			UserID:    userID,
			Action:    action,
			Details:   fmt.Sprintf("%v", details),
			Timestamp: time.Now().Unix(),
		})
		return nil
	}
	detailsJSON, _ := json.Marshal(details)
	_, err := db.Exec(`
		INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6::inet)`,
		nullableUUID(userID), action, entityType, nullableUUID(entityID), detailsJSON, nullableInet(ip))
	return err
}

func dbGetAuditLog(userID string, limit int) ([]map[string]any, error) {
	if !dbAvailable() {
		return nil, fmt.Errorf("database not available")
	}
	if limit <= 0 {
		limit = 50
	}
	rows, err := db.Query(`
		SELECT id, COALESCE(user_id::text,''), action, COALESCE(entity_type,''),
		       COALESCE(entity_id::text,''), COALESCE(details::text,'{}'),
		       COALESCE(ip_address::text,''), created_at
		FROM audit_log
		WHERE user_id = $1 OR $1 = ''
		ORDER BY created_at DESC LIMIT $2`, nullableUUID(userID), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []map[string]any
	for rows.Next() {
		var id, uid, action, etype, eid, details, ip string
		var createdAt time.Time
		if err := rows.Scan(&id, &uid, &action, &etype, &eid, &details, &ip, &createdAt); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id":          id,
			"user_id":     uid,
			"action":      action,
			"entity_type": etype,
			"entity_id":   eid,
			"details":     json.RawMessage(details),
			"ip_address":  ip,
			"timestamp":   createdAt.Unix(),
			"created_at":  createdAt,
		})
	}
	return out, nil
}

// ============================================================================
// AGENTS (from DB agents table)
// ============================================================================

// DBAgent maps to the agents table.
type DBAgent struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	Type             string    `json:"type"`
	Description      string    `json:"description"`
	Status           string    `json:"status"`
	Config           string    `json:"config"`
	Capabilities     []string  `json:"capabilities"`
	MaxConcurrentJobs int      `json:"max_concurrent_jobs"`
	LastHeartbeatAt  *time.Time `json:"last_heartbeat_at"`
	LastActiveAt     *time.Time `json:"last_active_at"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	// Runtime fields (not in DB but useful for API response)
	ContainerID      string    `json:"container_id,omitempty"`
}

func dbListAgents() ([]DBAgent, error) {
	if !dbAvailable() {
		return nil, fmt.Errorf("database not available")
	}
	rows, err := db.Query(`
		SELECT id, name, type, COALESCE(description,''), status,
		       COALESCE(config::text,'{}'), capabilities, max_concurrent_jobs,
		       last_heartbeat_at, last_active_at, created_at, updated_at
		FROM agents ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []DBAgent
	for rows.Next() {
		var a DBAgent
		var caps string
		if err := rows.Scan(&a.ID, &a.Name, &a.Type, &a.Description, &a.Status,
			&a.Config, &caps, &a.MaxConcurrentJobs,
			&a.LastHeartbeatAt, &a.LastActiveAt, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		a.Capabilities = parseTextArray(caps)
		out = append(out, a)
	}
	return out, nil
}

func dbGetAgent(id string) (*DBAgent, error) {
	if !dbAvailable() {
		return nil, fmt.Errorf("database not available")
	}
	a := &DBAgent{}
	var caps string
	err := db.QueryRow(`
		SELECT id, name, type, COALESCE(description,''), status,
		       COALESCE(config::text,'{}'), capabilities, max_concurrent_jobs,
		       last_heartbeat_at, last_active_at, created_at, updated_at
		FROM agents WHERE id = $1`, id).Scan(
		&a.ID, &a.Name, &a.Type, &a.Description, &a.Status,
		&a.Config, &caps, &a.MaxConcurrentJobs,
		&a.LastHeartbeatAt, &a.LastActiveAt, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, err
	}
	a.Capabilities = parseTextArray(caps)
	return a, nil
}

func dbCreateAgent(name, agentType, description string, capabilities []string, configJSON string) (*DBAgent, error) {
	if !dbAvailable() {
		return nil, fmt.Errorf("database not available")
	}
	if configJSON == "" {
		configJSON = "{}"
	}
	a := &DBAgent{}
	var caps string
	err := db.QueryRow(`
		INSERT INTO agents (name, type, description, capabilities, config)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, type, description, status,
		          config::text, capabilities, max_concurrent_jobs,
		          last_heartbeat_at, last_active_at, created_at, updated_at`,
		name, agentType, description, formatTextArray(capabilities), configJSON,
	).Scan(&a.ID, &a.Name, &a.Type, &a.Description, &a.Status,
		&a.Config, &caps, &a.MaxConcurrentJobs,
		&a.LastHeartbeatAt, &a.LastActiveAt, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, err
	}
	a.Capabilities = parseTextArray(caps)
	return a, nil
}

func dbUpdateAgent(id string, fields map[string]any) error {
	if !dbAvailable() {
		return fmt.Errorf("database not available")
	}
	setClauses := []string{}
	args := []any{}
	i := 1

	for k, v := range fields {
		switch k {
		case "name", "type", "description", "status":
			setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, i))
			args = append(args, v)
			i++
		case "config":
			setClauses = append(setClauses, fmt.Sprintf("config = $%d", i))
			b, _ := json.Marshal(v)
			args = append(args, string(b))
			i++
		case "capabilities":
			setClauses = append(setClauses, fmt.Sprintf("capabilities = $%d", i))
			if caps, ok := v.([]string); ok {
				args = append(args, formatTextArray(caps))
			} else {
				args = append(args, "{}")
			}
			i++
		case "last_heartbeat_at":
			setClauses = append(setClauses, fmt.Sprintf("last_heartbeat_at = $%d", i))
			args = append(args, time.Now())
			i++
		}
	}

	if len(setClauses) == 0 {
		return nil
	}

	setClauses = append(setClauses, "updated_at = NOW()")
	query := fmt.Sprintf("UPDATE agents SET %s WHERE id = $%d", strings.Join(setClauses, ", "), i)
	args = append(args, id)

	res, err := db.Exec(query, args...)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("agent not found")
	}
	return nil
}

func dbDeleteAgent(id string) error {
	if !dbAvailable() {
		return fmt.Errorf("database not available")
	}
	res, err := db.Exec("DELETE FROM agents WHERE id = $1", id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("agent not found")
	}
	return nil
}

func dbUpdateAgentHeartbeat(id string) error {
	if !dbAvailable() {
		return fmt.Errorf("database not available")
	}
	_, err := db.Exec("UPDATE agents SET last_heartbeat_at = NOW(), last_active_at = NOW() WHERE id = $1", id)
	return err
}

// ============================================================================
// JOBS
// ============================================================================

type DBJob struct {
	ID          string     `json:"id"`
	AgentID     *string    `json:"agent_id"`
	WorkflowID  *string    `json:"workflow_id"`
	Name        string     `json:"name"`
	Type        string     `json:"type"`
	Status      string     `json:"status"`
	Priority    int        `json:"priority"`
	Parameters  string     `json:"parameters"`
	Result      string     `json:"result"`
	Error       *string    `json:"error"`
	Progress    int        `json:"progress"`
	StartedAt   *time.Time `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

func dbCreateJob(agentID, name, jobType string, params map[string]any, createdBy string) (*DBJob, error) {
	if !dbAvailable() {
		return nil, fmt.Errorf("database not available")
	}
	paramsJSON, _ := json.Marshal(params)
	j := &DBJob{}
	err := db.QueryRow(`
		INSERT INTO jobs (agent_id, name, type, parameters, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, agent_id, workflow_id, name, type, status, priority,
		          parameters::text, result::text, error, progress,
		          started_at, completed_at, created_at`,
		nullableUUID(agentID), name, jobType, paramsJSON, nullableUUID(createdBy),
	).Scan(&j.ID, &j.AgentID, &j.WorkflowID, &j.Name, &j.Type, &j.Status,
		&j.Priority, &j.Parameters, &j.Result, &j.Error, &j.Progress,
		&j.StartedAt, &j.CompletedAt, &j.CreatedAt)
	return j, err
}

func dbListJobs(agentID string, limit int) ([]DBJob, error) {
	if !dbAvailable() {
		return nil, fmt.Errorf("database not available")
	}
	if limit <= 0 {
		limit = 50
	}
	query := `
		SELECT id, agent_id, workflow_id, name, type, status, priority,
		       parameters::text, result::text, error, progress,
		       started_at, completed_at, created_at
		FROM jobs`
	args := []any{}
	if agentID != "" {
		query += " WHERE agent_id = $1"
		args = append(args, agentID)
		query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", len(args)+1)
		args = append(args, limit)
	} else {
		query += " ORDER BY created_at DESC LIMIT $1"
		args = append(args, limit)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []DBJob
	for rows.Next() {
		var j DBJob
		if err := rows.Scan(&j.ID, &j.AgentID, &j.WorkflowID, &j.Name, &j.Type,
			&j.Status, &j.Priority, &j.Parameters, &j.Result, &j.Error,
			&j.Progress, &j.StartedAt, &j.CompletedAt, &j.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, j)
	}
	return out, nil
}

func dbUpdateJobStatus(jobID, status string, result map[string]any, errMsg string) error {
	if !dbAvailable() {
		return fmt.Errorf("database not available")
	}
	resultJSON, _ := json.Marshal(result)
	var errPtr *string
	if errMsg != "" {
		errPtr = &errMsg
	}
	now := time.Now()

	query := `UPDATE jobs SET status = $1, result = $2, error = $3, updated_at = $4`
	args := []any{status, resultJSON, errPtr, now}

	if status == "running" {
		query += ", started_at = $5 WHERE id = $6"
		args = append(args, now, jobID)
	} else if status == "completed" || status == "failed" {
		query += ", completed_at = $5 WHERE id = $6"
		args = append(args, now, jobID)
	} else {
		query += " WHERE id = $5"
		args = append(args, jobID)
	}

	_, err := db.Exec(query, args...)
	return err
}

// ============================================================================
// WORKFLOWS
// ============================================================================

type DBWorkflow struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Definition  string    `json:"definition"`
	Status      string    `json:"status"`
	TriggerType *string   `json:"trigger_type"`
	IsActive    bool      `json:"is_active"`
	Version     int       `json:"version"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func dbListWorkflows() ([]DBWorkflow, error) {
	if !dbAvailable() {
		return nil, fmt.Errorf("database not available")
	}
	rows, err := db.Query(`
		SELECT id, name, COALESCE(description,''), definition::text, status,
		       trigger_type, is_active, version, created_at, updated_at
		FROM workflows ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []DBWorkflow
	for rows.Next() {
		var w DBWorkflow
		if err := rows.Scan(&w.ID, &w.Name, &w.Description, &w.Definition, &w.Status,
			&w.TriggerType, &w.IsActive, &w.Version, &w.CreatedAt, &w.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, nil
}

func dbCreateWorkflow(name, description string, definition map[string]any, createdBy string) (*DBWorkflow, error) {
	if !dbAvailable() {
		return nil, fmt.Errorf("database not available")
	}
	defJSON, _ := json.Marshal(definition)
	w := &DBWorkflow{}
	err := db.QueryRow(`
		INSERT INTO workflows (name, description, definition, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING id, name, description, definition::text, status,
		          trigger_type, is_active, version, created_at, updated_at`,
		name, description, defJSON, nullableUUID(createdBy),
	).Scan(&w.ID, &w.Name, &w.Description, &w.Definition, &w.Status,
		&w.TriggerType, &w.IsActive, &w.Version, &w.CreatedAt, &w.UpdatedAt)
	return w, err
}

func dbUpdateWorkflow(id string, fields map[string]any) error {
	if !dbAvailable() {
		return fmt.Errorf("database not available")
	}
	setClauses := []string{}
	args := []any{}
	i := 1

	for k, v := range fields {
		switch k {
		case "name", "description", "status":
			setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, i))
			args = append(args, v)
			i++
		case "definition":
			setClauses = append(setClauses, fmt.Sprintf("definition = $%d", i))
			b, _ := json.Marshal(v)
			args = append(args, string(b))
			i++
		case "is_active":
			setClauses = append(setClauses, fmt.Sprintf("is_active = $%d", i))
			args = append(args, v)
			i++
		}
	}

	if len(setClauses) == 0 {
		return nil
	}

	setClauses = append(setClauses, "updated_at = NOW()", fmt.Sprintf("version = version + 1"))
	query := fmt.Sprintf("UPDATE workflows SET %s WHERE id = $%d", strings.Join(setClauses, ", "), i)
	args = append(args, id)

	res, err := db.Exec(query, args...)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("workflow not found")
	}
	return nil
}

func dbDeleteWorkflow(id string) error {
	if !dbAvailable() {
		return fmt.Errorf("database not available")
	}
	res, err := db.Exec("DELETE FROM workflows WHERE id = $1", id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("workflow not found")
	}
	return nil
}

// ============================================================================
// DASHBOARD STATS (from DB)
// ============================================================================

type DashboardStats struct {
	Agents     map[string]int `json:"agents"`
	Jobs       map[string]int `json:"jobs"`
	Workflows  map[string]int `json:"workflows"`
	Findings   map[string]int `json:"findings"`
	Containers map[string]int `json:"containers"`
}

func dbGetDashboardStats() (*DashboardStats, error) {
	if !dbAvailable() {
		return nil, fmt.Errorf("database not available")
	}
	stats := &DashboardStats{
		Agents:    map[string]int{},
		Jobs:      map[string]int{},
		Workflows: map[string]int{},
		Findings:  map[string]int{},
		Containers: map[string]int{},
	}

	// Agent counts
	rows, err := db.Query("SELECT status, COUNT(*) FROM agents GROUP BY status")
	if err == nil {
		defer rows.Close()
		total := 0
		for rows.Next() {
			var status string
			var count int
			rows.Scan(&status, &count)
			stats.Agents[status] = count
			total += count
		}
		stats.Agents["total"] = total
	}

	// Job counts
	rows2, err := db.Query("SELECT status, COUNT(*) FROM jobs GROUP BY status")
	if err == nil {
		defer rows2.Close()
		total := 0
		for rows2.Next() {
			var status string
			var count int
			rows2.Scan(&status, &count)
			stats.Jobs[status] = count
			total += count
		}
		stats.Jobs["total"] = total
	}

	// Workflow counts
	rows3, err := db.Query("SELECT status, COUNT(*) FROM workflows GROUP BY status")
	if err == nil {
		defer rows3.Close()
		total := 0
		for rows3.Next() {
			var status string
			var count int
			rows3.Scan(&status, &count)
			stats.Workflows[status] = count
			total += count
		}
		stats.Workflows["total"] = total
	}

	// Finding counts by severity
	rows4, err := db.Query("SELECT severity, COUNT(*) FROM findings GROUP BY severity")
	if err == nil {
		defer rows4.Close()
		total := 0
		for rows4.Next() {
			var severity string
			var count int
			rows4.Scan(&severity, &count)
			stats.Findings[severity] = count
			total += count
		}
		stats.Findings["total"] = total
	}

	return stats, nil
}

// dbGetRecentActivity returns recent audit log entries for the dashboard feed.
func dbGetRecentActivity(limit int) ([]map[string]any, error) {
	if !dbAvailable() {
		return nil, fmt.Errorf("database not available")
	}
	if limit <= 0 {
		limit = 20
	}
	rows, err := db.Query(`
		SELECT id, COALESCE(user_id::text,''), action, COALESCE(entity_type,''),
		       COALESCE(details::text,'{}'), created_at
		FROM audit_log ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []map[string]any
	for rows.Next() {
		var id, uid, action, etype, details string
		var createdAt time.Time
		if err := rows.Scan(&id, &uid, &action, &etype, &details, &createdAt); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id":          id,
			"type":        etype,
			"action":      action,
			"details":     json.RawMessage(details),
			"timestamp":   createdAt.Unix(),
			"created_at":  createdAt,
		})
	}
	return out, nil
}

// ============================================================================
// SEED DEFAULT AGENTS
// ============================================================================

// seedDefaultAgents inserts the 6 canonical agents if the agents table is empty.
func seedDefaultAgents() {
	if !dbAvailable() {
		return
	}
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM agents").Scan(&count); err != nil || count > 0 {
		return
	}

	defaults := []struct {
		name, agentType, desc string
		caps                  []string
	}{
		{"PATHFINDER", "recon", "Recon Scout — subdomain discovery, port scanning, asset enumeration",
			[]string{"subfinder", "httpx", "naabu", "shef", "ceye"}},
		{"BREACH", "web", "Web Hacker — XSS, SQLi, SSRF, IDOR, API exploitation, WAF evasion",
			[]string{"nuclei", "sqlmap", "dalfox", "ffuf", "recx"}},
		{"PHANTOM", "cloud", "Cloud Infiltrator — AWS/Azure/GCP misconfiguration detection",
			[]string{"ScoutSuite", "Prowler", "Pacu"}},
		{"SPECTER", "osint", "OSINT Detective — email enum, person lookup, credential leak detection",
			[]string{"theHarvester", "Sherlock", "SpiderFoot"}},
		{"CIPHER", "binary", "Binary Reverse Engineer — binary analysis, exploit development",
			[]string{"Ghidra", "radare2", "pwntools"}},
		{"SCRIBE", "report", "Report Writer — CVSS scoring, PoC writing, platform-specific reports",
			[]string{"markdown", "pdf", "platform-apis"}},
	}

	for _, d := range defaults {
		_, err := dbCreateAgent(d.name, d.agentType, d.desc, d.caps, "{}")
		if err != nil {
			log.Printf("[DB] Failed to seed agent %s: %v", d.name, err)
		}
	}
	log.Println("[DB] Seeded 6 default agents")
}

// ============================================================================
// HELPERS
// ============================================================================

// nullableUUID returns nil for empty strings so PostgreSQL UUID columns get NULL.
func nullableUUID(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// nullableInet returns nil for empty strings so PostgreSQL INET columns get NULL.
func nullableInet(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// parseTextArray converts a PostgreSQL text array literal like {a,b,c} to a Go string slice.
func parseTextArray(s string) []string {
	s = strings.TrimPrefix(s, "{")
	s = strings.TrimSuffix(s, "}")
	if s == "" {
		return []string{}
	}
	return strings.Split(s, ",")
}

// formatTextArray converts a Go string slice to a PostgreSQL text array literal.
func formatTextArray(arr []string) string {
	if len(arr) == 0 {
		return "{}"
	}
	return "{" + strings.Join(arr, ",") + "}"
}
