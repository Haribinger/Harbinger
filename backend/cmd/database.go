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
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUser, c.DBPass, c.DBName, c.DBSSLMode,
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
	db.SetConnMaxIdleTime(10 * time.Minute)

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

// closeDB closes the database connection if available.
func closeDB() {
	if db != nil {
		db.Close()
	}
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

// ============================================================================
// CODE HEALTH METRICS
// ============================================================================

// ensureCodeHealthTable creates the code_health_scans table if it doesn't exist.
func ensureCodeHealthTable() {
	if !dbAvailable() {
		return
	}
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS code_health_scans (
			id          SERIAL PRIMARY KEY,
			date        TEXT NOT NULL,
			any_types   INT DEFAULT 0,
			console_logs INT DEFAULT 0,
			test_coverage INT DEFAULT 0,
			deps_outdated INT DEFAULT 0,
			conventions  INT DEFAULT 0,
			score        INT DEFAULT 0,
			created_at   TIMESTAMPTZ DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Printf("[DB] Failed to create code_health_scans table: %v", err)
	}
}

// dbStoreHealthMetric inserts a health metric into the database.
func dbStoreHealthMetric(m HealthMetric) error {
	if !dbAvailable() {
		return fmt.Errorf("database not available")
	}
	_, err := db.Exec(`
		INSERT INTO code_health_scans (date, any_types, console_logs, test_coverage, deps_outdated, conventions, score)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		m.Date, m.AnyTypes, m.ConsoleLogs, m.TestCoverage, m.DepsOutdated, m.Conventions, m.Score,
	)
	return err
}

// dbLoadHealthHistory loads metrics since a given date.
func dbLoadHealthHistory(since string) ([]HealthMetric, error) {
	if !dbAvailable() {
		return nil, fmt.Errorf("database not available")
	}
	rows, err := db.Query(`
		SELECT date, any_types, console_logs, test_coverage, deps_outdated, conventions, score
		FROM code_health_scans
		WHERE date >= $1
		ORDER BY date ASC`, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var metrics []HealthMetric
	for rows.Next() {
		var m HealthMetric
		if err := rows.Scan(&m.Date, &m.AnyTypes, &m.ConsoleLogs, &m.TestCoverage, &m.DepsOutdated, &m.Conventions, &m.Score); err != nil {
			return nil, err
		}
		metrics = append(metrics, m)
	}
	return metrics, nil
}

// ============================================================================
// MODEL ROUTES
// ============================================================================

// ensureModelRoutesTable creates the model_routes table if it doesn't exist.
func ensureModelRoutesTable() {
	if !dbAvailable() {
		return
	}
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS model_routes (
			id               SERIAL PRIMARY KEY,
			task_type        TEXT NOT NULL UNIQUE,
			default_provider TEXT NOT NULL,
			fallback_provider TEXT DEFAULT '',
			model            TEXT NOT NULL,
			fallback_model   TEXT DEFAULT '',
			max_tokens       INT DEFAULT 2000,
			cost_optimize    BOOLEAN DEFAULT true,
			created_at       TIMESTAMPTZ DEFAULT NOW(),
			updated_at       TIMESTAMPTZ DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Printf("[DB] Failed to create model_routes table: %v", err)
	}

	// Config table
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS model_router_config (
			id               SERIAL PRIMARY KEY,
			local_mode       BOOLEAN DEFAULT false,
			auto_classify    BOOLEAN DEFAULT true,
			default_provider TEXT DEFAULT 'ollama',
			cost_optimization BOOLEAN DEFAULT true,
			updated_at       TIMESTAMPTZ DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Printf("[DB] Failed to create model_router_config table: %v", err)
	}
}

// dbSaveModelRoutes persists routes and config to the database.
func dbSaveModelRoutes(routes []ModelRoute, config ModelRouterConfig) error {
	if !dbAvailable() {
		return fmt.Errorf("database not available")
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Upsert routes
	for _, r := range routes {
		_, err := tx.Exec(`
			INSERT INTO model_routes (task_type, default_provider, fallback_provider, model, fallback_model, max_tokens, cost_optimize, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
			ON CONFLICT (task_type) DO UPDATE SET
				default_provider = EXCLUDED.default_provider,
				fallback_provider = EXCLUDED.fallback_provider,
				model = EXCLUDED.model,
				fallback_model = EXCLUDED.fallback_model,
				max_tokens = EXCLUDED.max_tokens,
				cost_optimize = EXCLUDED.cost_optimize,
				updated_at = NOW()`,
			r.TaskType, r.DefaultProvider, r.FallbackProvider, r.Model, r.FallbackModel, r.MaxTokens, r.CostOptimize,
		)
		if err != nil {
			return err
		}
	}

	// Upsert config (single row)
	_, err = tx.Exec(`
		INSERT INTO model_router_config (id, local_mode, auto_classify, default_provider, cost_optimization, updated_at)
		VALUES (1, $1, $2, $3, $4, NOW())
		ON CONFLICT (id) DO UPDATE SET
			local_mode = EXCLUDED.local_mode,
			auto_classify = EXCLUDED.auto_classify,
			default_provider = EXCLUDED.default_provider,
			cost_optimization = EXCLUDED.cost_optimization,
			updated_at = NOW()`,
		config.LocalMode, config.AutoClassify, config.DefaultProvider, config.CostOptimization,
	)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// dbLoadModelRoutes loads routes and config from the database.
func dbLoadModelRoutes() ([]ModelRoute, ModelRouterConfig, error) {
	config := ModelRouterConfig{
		LocalMode:        false,
		AutoClassify:     true,
		DefaultProvider:  "ollama",
		CostOptimization: true,
	}

	if !dbAvailable() {
		return nil, config, fmt.Errorf("database not available")
	}

	// Load config
	err := db.QueryRow(`SELECT local_mode, auto_classify, default_provider, cost_optimization FROM model_router_config WHERE id = 1`).
		Scan(&config.LocalMode, &config.AutoClassify, &config.DefaultProvider, &config.CostOptimization)
	if err != nil {
		// Not found is ok — use defaults
	}

	// Load routes
	rows, err := db.Query(`
		SELECT task_type, default_provider, fallback_provider, model, fallback_model, max_tokens, cost_optimize
		FROM model_routes
		ORDER BY CASE task_type
			WHEN 'trivial' THEN 1
			WHEN 'simple' THEN 2
			WHEN 'moderate' THEN 3
			WHEN 'complex' THEN 4
			WHEN 'massive' THEN 5
			ELSE 6
		END`)
	if err != nil {
		return nil, config, err
	}
	defer rows.Close()

	var routes []ModelRoute
	for rows.Next() {
		var r ModelRoute
		if err := rows.Scan(&r.TaskType, &r.DefaultProvider, &r.FallbackProvider, &r.Model, &r.FallbackModel, &r.MaxTokens, &r.CostOptimize); err != nil {
			return nil, config, err
		}
		routes = append(routes, r)
	}

	return routes, config, nil
}

// ============================================================================
// AUTONOMOUS INTELLIGENCE — DB persistence for agent thoughts
// ============================================================================

// ensureAutonomousTable creates the agent_thoughts table if it doesn't exist.
func ensureAutonomousTable() {
	if !dbAvailable() {
		return
	}
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS agent_thoughts (
			id              TEXT PRIMARY KEY,
			agent_id        TEXT NOT NULL,
			agent_name      TEXT DEFAULT '',
			type            TEXT DEFAULT 'observation',
			category        TEXT DEFAULT '',
			title           TEXT NOT NULL,
			content         TEXT DEFAULT '',
			priority        INT DEFAULT 3,
			status          TEXT DEFAULT 'pending',
			efficiency      JSONB,
			data            JSONB,
			created_at      BIGINT DEFAULT 0
		)
	`)
	if err != nil {
		log.Printf("[DB] Failed to create agent_thoughts table: %v", err)
		return
	}
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_thoughts_agent ON agent_thoughts(agent_id)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_thoughts_status ON agent_thoughts(status)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_thoughts_type ON agent_thoughts(type)`)
}

func ensureChatTables() {
	if db == nil {
		return
	}
	db.Exec(`CREATE TABLE IF NOT EXISTS chat_sessions (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		title TEXT NOT NULL DEFAULT 'New Chat',
		model TEXT NOT NULL DEFAULT 'default',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS chat_messages (
		id TEXT PRIMARY KEY,
		session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
		role TEXT NOT NULL,
		content TEXT NOT NULL,
		model TEXT,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id)`)
}

func ensureC2Tables() {
	if db == nil {
		return
	}
	db.Exec(`CREATE TABLE IF NOT EXISTS c2_frameworks (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		type TEXT NOT NULL,
		host TEXT,
		port INTEGER,
		status TEXT NOT NULL DEFAULT 'disconnected',
		api_key TEXT,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS c2_operations (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		type TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'planning',
		target TEXT,
		description TEXT,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS c2_implants (
		id TEXT PRIMARY KEY,
		framework_id TEXT REFERENCES c2_frameworks(id),
		hostname TEXT,
		ip TEXT,
		os TEXT,
		arch TEXT,
		status TEXT NOT NULL DEFAULT 'active',
		last_checkin TIMESTAMPTZ,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
}

// dbStoreThought inserts a thought into PostgreSQL.
func dbStoreThought(t AgentThought) error {
	if !dbAvailable() {
		return fmt.Errorf("database not available")
	}
	effJSON, _ := json.Marshal(t.Efficiency)
	dataJSON := t.Data
	if dataJSON == nil {
		dataJSON = json.RawMessage("null")
	}
	_, err := db.Exec(`
		INSERT INTO agent_thoughts (id, agent_id, agent_name, type, category, title, content, priority, status, efficiency, data, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (id) DO NOTHING`,
		t.ID, t.AgentID, t.AgentName, t.Type, t.Category, t.Title, t.Content, t.Priority, t.Status, effJSON, dataJSON, t.CreatedAt,
	)
	return err
}

// dbListThoughts queries thoughts with optional filters.
func dbListThoughts(agentID, thoughtType, status, category string, limit int) ([]AgentThought, error) {
	if !dbAvailable() {
		return nil, fmt.Errorf("database not available")
	}

	query := `SELECT id, agent_id, agent_name, type, category, title, content, priority, status, efficiency, data, created_at
		FROM agent_thoughts WHERE 1=1`
	args := []any{}
	argN := 1

	if agentID != "" {
		query += fmt.Sprintf(" AND agent_id = $%d", argN)
		args = append(args, agentID)
		argN++
	}
	if thoughtType != "" {
		query += fmt.Sprintf(" AND type = $%d", argN)
		args = append(args, thoughtType)
		argN++
	}
	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argN)
		args = append(args, status)
		argN++
	}
	if category != "" {
		query += fmt.Sprintf(" AND category = $%d", argN)
		args = append(args, category)
		argN++
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", argN)
	args = append(args, limit)

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var thoughts []AgentThought
	for rows.Next() {
		var t AgentThought
		var effJSON, dataJSON sql.NullString
		if err := rows.Scan(&t.ID, &t.AgentID, &t.AgentName, &t.Type, &t.Category, &t.Title, &t.Content, &t.Priority, &t.Status, &effJSON, &dataJSON, &t.CreatedAt); err != nil {
			return nil, err
		}
		if effJSON.Valid && effJSON.String != "null" {
			var eff EfficiencyScore
			if json.Unmarshal([]byte(effJSON.String), &eff) == nil {
				t.Efficiency = &eff
			}
		}
		if dataJSON.Valid && dataJSON.String != "null" {
			t.Data = json.RawMessage(dataJSON.String)
		}
		thoughts = append(thoughts, t)
	}
	if thoughts == nil {
		thoughts = []AgentThought{}
	}
	return thoughts, nil
}

// dbGetThought retrieves a single thought by ID.
func dbGetThought(id string) (*AgentThought, error) {
	if !dbAvailable() {
		return nil, fmt.Errorf("database not available")
	}
	var t AgentThought
	var effJSON, dataJSON sql.NullString
	err := db.QueryRow(`SELECT id, agent_id, agent_name, type, category, title, content, priority, status, efficiency, data, created_at
		FROM agent_thoughts WHERE id = $1`, id).Scan(
		&t.ID, &t.AgentID, &t.AgentName, &t.Type, &t.Category, &t.Title, &t.Content, &t.Priority, &t.Status, &effJSON, &dataJSON, &t.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if effJSON.Valid && effJSON.String != "null" {
		var eff EfficiencyScore
		if json.Unmarshal([]byte(effJSON.String), &eff) == nil {
			t.Efficiency = &eff
		}
	}
	if dataJSON.Valid && dataJSON.String != "null" {
		t.Data = json.RawMessage(dataJSON.String)
	}
	return &t, nil
}

// dbUpdateThoughtStatus updates only the status field.
func dbUpdateThoughtStatus(id, status string) error {
	if !dbAvailable() {
		return fmt.Errorf("database not available")
	}
	_, err := db.Exec(`UPDATE agent_thoughts SET status = $1 WHERE id = $2`, status, id)
	return err
}

// dbDeleteThought removes a thought from the database.
func dbDeleteThought(id string) error {
	if !dbAvailable() {
		return fmt.Errorf("database not available")
	}
	_, err := db.Exec(`DELETE FROM agent_thoughts WHERE id = $1`, id)
	return err
}

// dbGetThoughtStats computes aggregate statistics from the database.
func dbGetThoughtStats() (*AutonomousStats, error) {
	if !dbAvailable() {
		return nil, fmt.Errorf("database not available")
	}

	stats := &AutonomousStats{
		AutomationsByType:  map[string]int{},
		ThoughtsByAgent:    map[string]int{},
		ThoughtsByCategory: map[string]int{},
	}

	// Totals by status
	rows, err := db.Query(`SELECT status, COUNT(*) FROM agent_thoughts GROUP BY status`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var s string
		var count int
		if err := rows.Scan(&s, &count); err != nil {
			continue
		}
		stats.TotalThoughts += count
		switch s {
		case "pending", "approved":
			stats.ActiveThoughts += count
		case "implemented":
			stats.ImplementedCount += count
		}
		if s == "pending" {
			stats.PendingProposals = count
		}
	}

	// By agent
	rows2, err := db.Query(`SELECT COALESCE(NULLIF(agent_name,''), agent_id), COUNT(*) FROM agent_thoughts GROUP BY 1`)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var name string
			var count int
			if rows2.Scan(&name, &count) == nil {
				stats.ThoughtsByAgent[name] = count
			}
		}
	}

	// By category
	rows3, err := db.Query(`SELECT category, COUNT(*) FROM agent_thoughts WHERE category != '' GROUP BY category`)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var cat string
			var count int
			if rows3.Scan(&cat, &count) == nil {
				stats.ThoughtsByCategory[cat] = count
			}
		}
	}

	// Average efficiency
	var avgEff sql.NullFloat64
	db.QueryRow(`SELECT AVG((efficiency->>'cost_benefit')::float) FROM agent_thoughts WHERE efficiency IS NOT NULL AND efficiency != 'null'`).Scan(&avgEff)
	if avgEff.Valid {
		stats.AvgEfficiency = avgEff.Float64
	}

	return stats, nil
}
