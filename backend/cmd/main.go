package main

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// ---- Config ----

type VPSNode struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Provider string `json:"provider"`
	IP       string `json:"ip"`
	Status   string `json:"status"`
	Latency  int64  `json:"latency"`
	Region   string `json:"region"`
	OS       string `json:"os"`
}

type C2Server struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Type   string `json:"type"`
	Status string `json:"status"`
	VPSID  string `json:"vpsId"`
}

type Implant struct {
	ID          string `json:"id"`
	C2ID        string `json:"c2Id"`
	Hostname    string `json:"hostname"`
	IP          string `json:"ip"`
	Status      string `json:"status"`
	LastCheckIn string `json:"lastCheckIn"`
}

type MFASecret struct {
	UserID string `json:"user_id"`
	Secret string `json:"secret"`
}

type Session struct {
	ID           string `json:"id"`
	UserID       string `json:"user_id"`
	Device       string `json:"device"`
	IPAddress    string `json:"ip_address"`
	Location     string `json:"location"`
	LastActivity int64  `json:"last_activity"`
	CreatedAt    int64  `json:"created_at"`
}

type APIKey struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	Name      string `json:"name"`
	Key       string `json:"key"` // Hashed or encrypted in real scenarios
	CreatedAt int64  `json:"created_at"`
	LastUsed  int64  `json:"last_used"`
}

type AuditLogEntry struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	Action    string `json:"action"`
	Details   string `json:"details"`
	Timestamp int64  `json:"timestamp"`
}

type HostingerConfig struct {
	UserID    string `json:"user_id"`
	APIKey    string `json:"api_key"`
	Connected bool   `json:"connected"`
}

type CloudflareConfig struct {
	UserID    string `json:"user_id"`
	APIToken  string `json:"api_token"`
	Connected bool   `json:"connected"`
}

type HostingerVPS struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Status    string  `json:"status"`
	IPAddress string  `json:"ip_address"`
	Plan      string  `json:"plan"`
	Region    string  `json:"region"`
	Price     float64 `json:"price"`
	CPU       int     `json:"cpu"`
	RAM       int     `json:"ram"`
	Disk      int     `json:"disk"`
}

type CloudflareZone struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type CloudflareDNSRecord struct {
	ID      string `json:"id"`
	ZoneID  string `json:"zone_id"`
	Name    string `json:"name"`
	Type    string `json:"type"`
	Content string `json:"content"`
	Proxied bool   `json:"proxied"`
}

type Proxy struct {
	ID       string `json:"id"`
	UserID   string `json:"user_id"`
	Type     string `json:"type"`
	Address  string `json:"address"`
	Port     int    `json:"port"`
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
	Health   string `json:"health"`
}

type ProxyChainConfig struct {
	UserID         string `json:"user_id"`
	Order          string `json:"order"`
	TorIntegration bool   `json:"tor_integration"`
}

type Playbook struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Category     string   `json:"category"`
	Description  string   `json:"description"`
	MitreAttacks []string `json:"mitreAttacks"`
	Steps        []string `json:"steps"`
}

// In-memory storage for demonstration purposes
var vpsNodes = []VPSNode{}
var c2Servers = []C2Server{}
var implants = []Implant{}
var mfaSecrets = make(map[string]MFASecret)
var sessions = make(map[string]Session)
var apiKeys = make(map[string]APIKey)
var auditLog = []AuditLogEntry{}
var hostingerConfigs = make(map[string]HostingerConfig)
var cloudflareConfigs = make(map[string]CloudflareConfig)
var hostingerVpsList = make(map[string][]HostingerVPS)
var cloudflareZonesList = make(map[string][]CloudflareZone)
var cloudflareDnsRecordsList = make(map[string][]CloudflareDNSRecord)
var proxies = make(map[string][]Proxy)
var proxyChainConfigs = make(map[string]ProxyChainConfig)

var playbooks = []Playbook{
	{
		ID:          "pb-1",
		Name:        "Initial Access - Phishing",
		Category:    "Initial Access",
		Description: "Execute a targeted phishing campaign to gain initial access.",
		MitreAttacks: []string{"T1566.001 - Spearphishing Attachment"},
		Steps:       []string{"Craft phishing email", "Send emails", "Monitor clicks", "Deploy implant"},
	},
	{
		ID:          "pb-2",
		Name:        "Persistence - Scheduled Task",
		Category:    "Persistence",
		Description: "Establish persistence using a scheduled task.",
		MitreAttacks: []string{"T1053.005 - Scheduled Task/Job: Scheduled Task"},
		Steps:       []string{"Create scheduled task", "Verify execution"},
	},
}

type Config struct {
	AppName           string
	AppEnv            string
	Port              string
	DBHost            string
	DBPort            string
	DBName            string
	DBUser            string
	DBPass            string
	RedisHost         string
	RedisPort         string
	Neo4jHost         string
	Neo4jPort         string
	JWTSecret         string
	LogLevel          string
	MCPEnabled        bool
	HexStrikeURL      string
	PentagiURL        string
	RedteamURL        string
	MCPUIURL          string
	BrowserURL        string
	DockerSocket      string
	GitHubClientID string
	GitHubSecret    string
	AppURL          string
	GitHubClientSecret string
	GitHubRedirectURL string
}

func loadConfig() Config {
	appURL := getEnv("APP_URL", "http://localhost:3000")
	return Config{
		AppName:            getEnv("APP_NAME", "Harbinger"),
		AppEnv:             getEnv("APP_ENV", "development"),
		Port:               getEnv("APP_PORT", "8080"),
		DBHost:             getEnv("DB_HOST", "localhost"),
		DBPort:             getEnv("DB_PORT", "5432"),
		DBName:             getEnv("DB_NAME", "harbinger"),
		DBUser:             getEnv("DB_USER", "harbinger"),
		DBPass:             getEnv("DB_PASSWORD", "change-me"),
		RedisHost:          getEnv("REDIS_HOST", "localhost"),
		RedisPort:          getEnv("REDIS_PORT", "6379"),
		Neo4jHost:          getEnv("NEO4J_HOST", "localhost"),
		Neo4jPort:          getEnv("NEO4J_PORT", "7687"),
		JWTSecret:          getEnv("JWT_SECRET", "change-me-in-production"),
		LogLevel:           getEnv("LOG_LEVEL", "info"),
		MCPEnabled:         getEnv("MCP_ENABLED", "true") == "true",
		HexStrikeURL:       getEnv("HEXSTRIKE_URL", ""),
		PentagiURL:         getEnv("PENTAGI_URL", ""),
		RedteamURL:         getEnv("REDTEAM_URL", ""),
		MCPUIURL:           getEnv("MCP_UI_URL", ""),
		BrowserURL:         getEnv("BROWSER_SERVICE_URL", ""),
		DockerSocket:       getEnv("DOCKER_SOCKET", "/var/run/docker.sock"),
		GitHubClientID:     getEnv("GITHUB_CLIENT_ID", ""),
		GitHubClientSecret: getEnv("GITHUB_CLIENT_SECRET", ""),
		AppURL:             appURL,
		GitHubRedirectURL:  getEnv("GITHUB_REDIRECT_URL", appURL+"/api/auth/github/callback"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// ---- Response helpers ----

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key")
		w.Header().Set("Access-Control-Expose-Headers", "Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func handleGitHubLogin(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "GitHub OAuth not implemented yet", http.StatusNotImplemented)
}

func handleGitHubCallback(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "GitHub OAuth callback not implemented yet", http.StatusNotImplemented)
}

// ---- JWT Token Functions ----

type Claims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Provider string `json:"provider"`
	Exp      int64  `json:"exp"`
}

func generateJWT(userID, username, email, provider string) (string, error) {
	now := time.Now().Unix()
	claims := Claims{
		UserID:   userID,
		Username: username,
		Email:    email,
		Provider: provider,
		Exp:      now + 24*60*60, // 24 hours
	}

	// Create header
	header := map[string]string{
		"alg": "HS256",
		"typ": "JWT",
	}
	headerJSON, _ := json.Marshal(header)
	claimsJSON, _ := json.Marshal(claims)

	headerB64 := base64URLEncode(headerJSON)
	claimsB64 := base64URLEncode(claimsJSON)

	signatureInput := headerB64 + "." + claimsB64
	h := hmac.New(sha256.New, []byte(cfg.JWTSecret))
	h.Write([]byte(signatureInput))
	signature := base64URLEncode(h.Sum(nil))

	return headerB64 + "." + claimsB64 + "." + signature, nil
}

func validateJWT(tokenString string) (*Claims, error) {
	parts := strings.Split(tokenString, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid token format")
	}

	// Verify signature
	signatureInput := parts[0] + "." + parts[1]
	h := hmac.New(sha256.New, []byte(cfg.JWTSecret))
	h.Write([]byte(signatureInput))
	expectedSig := base64URLEncode(h.Sum(nil))

	if !hmac.Equal([]byte(parts[2]), []byte(expectedSig)) {
		return nil, fmt.Errorf("invalid signature")
	}

	// Decode claims
	claimsJSON, err := base64URLDecode(parts[1])
	if err != nil {
		return nil, err
	}

	var claims Claims
	if err := json.Unmarshal(claimsJSON, &claims); err != nil {
		return nil, err
	}

	// Check expiration
	if time.Now().Unix() > claims.Exp {
		return nil, fmt.Errorf("token expired")
	}

	return &claims, nil
}

func base64URLEncode(data []byte) string {
	return strings.TrimRight(base64.URLEncoding.EncodeToString(data), "=")
}

func base64URLDecode(s string) ([]byte, error) {
	// Add padding if needed
	padding := 4 - len(s)%4
	if padding != 4 {
		s += strings.Repeat("=", padding)
	}
	return base64.URLEncoding.DecodeString(s)
}

// ---- GitHub OAuth Functions ----

type GitHubUser struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatar_url"`
}

type GitHubTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	Scope       string `json:"scope"`
}

func exchangeGitHubCode(code string) (*GitHubTokenResponse, error) {
	if cfg.GitHubClientID == "" || cfg.GitHubClientSecret == "" {
		return nil, fmt.Errorf("GitHub OAuth not configured")
	}

	data := url.Values{}
	data.Set("client_id", cfg.GitHubClientID)
	data.Set("client_secret", cfg.GitHubClientSecret)
	data.Set("code", code)
	data.Set("redirect_uri", cfg.GitHubRedirectURL)

	req, err := http.NewRequest("POST", "https://github.com/login/oauth/access_token", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub token exchange failed: %s", string(body))
	}

	var tokenResp GitHubTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, err
	}

	return &tokenResp, nil
}

func getGitHubUser(accessToken string) (*GitHubUser, error) {
	req, err := http.NewRequest("GET", "https://api.github.com/user", nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API error: %s", string(body))
	}

	var user GitHubUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}

	return &user, nil
}

// ---- Auth Middleware ----

func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]interface{}{
				"ok":    false,
				"error": "Authorization header required",
			})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			writeJSON(w, http.StatusUnauthorized, map[string]interface{}{
				"ok":    false,
				"error": "Invalid Authorization header format",
			})
			return
		}

		token := parts[1]
		claims, err := validateJWT(token)
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]interface{}{
				"ok":    false,
				"error": err.Error(),
			})
			return
		}

		// Add claims to context
		ctx := context.WithValue(r.Context(), "userID", claims.UserID)
		ctx = context.WithValue(ctx, "username", claims.Username)
		ctx = context.WithValue(ctx, "email", claims.Email)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

func getUserIDFromContext(ctx context.Context) (string, error) {
	userID, ok := ctx.Value("userID").(string)
	if !ok || userID == "" {
		return "", fmt.Errorf("user ID not found in context")
	}
	return userID, nil
}

// ---- Handlers ----

var cfg Config

func main() {
	cfg = loadConfig()

	mux := http.NewServeMux()

	// Public routes
	mux.HandleFunc("GET /", handleHome)
	mux.HandleFunc("GET /health", handleHealthCheck)
	mux.HandleFunc("GET /api/auth/github/login", handleGitHubLogin)
	mux.HandleFunc("GET /api/auth/github/callback", handleGitHubCallback)

	// Auth & Security Endpoints (some public, some protected)
	mux.HandleFunc("POST /api/v1/auth/mfa/setup", authMiddleware(handleMfaSetup))
	mux.HandleFunc("POST /api/v1/auth/mfa/verify", authMiddleware(handleMfaVerify))
	mux.HandleFunc("GET /api/v1/auth/sessions", authMiddleware(handleListSessions))
	mux.HandleFunc("DELETE /api/v1/auth/sessions/{id}", authMiddleware(handleRevokeSession))
	mux.HandleFunc("GET /api/v1/auth/audit", authMiddleware(handleGetAuditLog))
	mux.HandleFunc("POST /api/v1/auth/apikeys", authMiddleware(handleCreateApiKey))
	mux.HandleFunc("DELETE /api/v1/auth/apikeys/{id}", authMiddleware(handleRevokeApiKey))
	mux.HandleFunc("GET /api/v1/auth/apikeys", authMiddleware(handleListApiKeys))

	// Hosting Provider Endpoints
	mux.HandleFunc("POST /api/v1/providers/hostinger/connect", authMiddleware(handleHostingerConnect))
	mux.HandleFunc("GET /api/v1/providers/hostinger/vps", authMiddleware(handleListHostingerVps))
	mux.HandleFunc("POST /api/v1/providers/hostinger/vps", authMiddleware(handleCreateHostingerVps))
	mux.HandleFunc("POST /api/v1/providers/cloudflare/connect", authMiddleware(handleCloudflareConnect))
	mux.HandleFunc("GET /api/v1/providers/cloudflare/zones", authMiddleware(handleListCloudflareZones))
	mux.HandleFunc("POST /api/v1/providers/cloudflare/tunnel", authMiddleware(handleCreateCloudflareTunnel))
	mux.HandleFunc("POST /api/v1/providers/cloudflare/access", authMiddleware(handleConfigureCloudflareAccess))
	mux.HandleFunc("GET /api/v1/providers/cloudflare/waf", authMiddleware(handleGetCloudflareWafRules))

	// Proxy Management Endpoints
	mux.HandleFunc("GET /api/v1/security/proxies", authMiddleware(handleListProxies))
	mux.HandleFunc("POST /api/v1/security/proxies", authMiddleware(handleAddProxy))
	mux.HandleFunc("POST /api/v1/security/proxies/test", authMiddleware(handleTestProxyChain))
	mux.HandleFunc("PUT /api/v1/security/proxies/chain", authMiddleware(handleUpdateProxyChainOrder))

	// Protected routes
	mux.HandleFunc("GET /api/v1/vps", authMiddleware(handleListVPSNodes))
	mux.HandleFunc("POST /api/v1/vps", authMiddleware(handleCreateVPSNode))
	mux.HandleFunc("GET /api/v1/c2", authMiddleware(handleListC2Servers))
	mux.HandleFunc("POST /api/v1/c2", authMiddleware(handleCreateC2Server))
	mux.HandleFunc("GET /api/v1/implants", authMiddleware(handleListImplants))
	mux.HandleFunc("POST /api/v1/implants", authMiddleware(handleCreateImplant))
	mux.HandleFunc("GET /api/v1/playbooks", authMiddleware(handleListPlaybooks))
	mux.HandleFunc("GET /api/v1/playbooks/{id}", authMiddleware(handleGetPlaybook))
	mux.HandleFunc("GET /api/v1/docker/containers", authMiddleware(handleDockerContainers))
	mux.HandleFunc("POST /api/v1/docker/containers", authMiddleware(handleCreateContainer))
	mux.HandleFunc("POST /api/v1/docker/containers/{id}/{action}", authMiddleware(handleContainerAction))
	mux.HandleFunc("GET /api/v1/docker/containers/{id}/logs", authMiddleware(handleContainerLogs))
	mux.HandleFunc("GET /api/v1/docker/images", authMiddleware(handleDockerImages))
	mux.HandleFunc("GET /api/v1/mcp", authMiddleware(handleMCPServers))
	mux.HandleFunc("GET /api/v1/dashboard/stats", authMiddleware(handleDashboardStats))
	mux.HandleFunc("GET /api/v1/dashboard/activity", authMiddleware(handleDashboardActivity))
	mux.HandleFunc("GET /api/v1/dashboard/health", authMiddleware(handleDashboardHealth))

	// Skills — reads from SKILLS_DIR (defaults to /app/skills in Docker)
	mux.HandleFunc("GET /api/v1/skills", authMiddleware(handleListSkills))
	mux.HandleFunc("GET /api/v1/skills/{id}", authMiddleware(handleGetSkill))

	// Also mount under /api/skills for direct frontend calls (no v1 prefix)
	mux.HandleFunc("GET /api/skills", authMiddleware(handleListSkills))
	mux.HandleFunc("GET /api/skills/{id}", authMiddleware(handleGetSkill))

	log.Printf("Server starting on :%s\n", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, corsMiddleware(mux)))
}

func handleHome(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "Welcome to Harbinger API"})
}

func handleHealthCheck(w http.ResponseWriter, r *http.Request) {
	var checks []interface{}

	// Check database connection (simulated)
	dbStatus := "ok"
	dbFix := ""
	if cfg.DBHost == "localhost" && cfg.DBPort == "5432" { // Example check
		dbStatus = "warning"
		dbFix = "Configure a production database in .env"
	}
	checks = append(checks, map[string]string{"id": "database", "name": "Database", "status": dbStatus, "fix": dbFix})

	// Check Redis connection (simulated)
	redisStatus := "ok"
	redisFix := ""
	if cfg.RedisHost == "localhost" && cfg.RedisPort == "6379" { // Example check
		redisStatus = "warning"
		redisFix = "Configure a production Redis in .env"
	}
	checks = append(checks, map[string]string{"id": "redis", "name": "Redis", "status": redisStatus, "fix": redisFix})

	// Check Docker socket
	dockerStatus := "error"
	dockerFix := "Docker socket not found or inaccessible"
	if dockerAvailable() {
		dockerStatus = "connected"
	} else {
		dockerFix = "Mount /var/run/docker.sock or set DOCKER_SOCKET env var"
	}
	checks = append(checks, map[string]string{"id": "docker", "name": "Docker", "status": dockerStatus, "fix": dockerFix})

	writeJSON(w, http.StatusOK, map[string]interface{}{"checks": checks})
}

// ---- Auth & Security Handlers ----

// handleMfaSetup sets up MFA for a user
func handleMfaSetup(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	// Generate a new MFA secret
	secret := generateRandomString(32)
	mfaSecrets[userID] = MFASecret{UserID: userID, Secret: secret}

	// In a real application, you would generate a QR code URL here
	// For now, just return the secret
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "secret": secret})
}

// handleMfaVerify verifies an MFA code
func handleMfaVerify(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	var reqBody struct {
		Code string `json:"code"`
	} 
	
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "Invalid request body"})
		return
	}

	_, ok := mfaSecrets[userID]
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "MFA not set up for this user"})
		return
	}

	// Simulate TOTP verification (replace with actual TOTP library)
	// For demonstration, we'll just check if the code is 
    // For demonstration, we'll just check if the code is '123456'
	if reqBody.Code == "123456" { // Replace with actual TOTP verification
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "message": "MFA verified successfully"})
		return
	}

	writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": "Invalid MFA code"})
}

// handleListSessions lists active sessions for a user
func handleListSessions(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	userSessions := []Session{}
	for _, session := range sessions {
		if session.UserID == userID {
			userSessions = append(userSessions, session)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "sessions": userSessions})
}

// handleRevokeSession revokes a specific session
func handleRevokeSession(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	sessionID := r.PathValue("id")

	if session, ok := sessions[sessionID]; ok && session.UserID == userID {
		delete(sessions, sessionID)
		auditLog = append(auditLog, AuditLogEntry{ID: generateRandomString(10), UserID: userID, Action: "Session Revoked", Details: fmt.Sprintf("Session ID: %s", sessionID), Timestamp: time.Now().Unix()})
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "message": "Session revoked"})
		return
	}

	writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": "Session not found or unauthorized"})
}

// handleGetAuditLog retrieves audit log entries for a user
func handleGetAuditLog(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	userAuditLog := []AuditLogEntry{}
	for _, entry := range auditLog {
		if entry.UserID == userID {
			userAuditLog = append(userAuditLog, entry)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "audit_log": userAuditLog})
}

// handleCreateApiKey creates a new API key for a user
func handleCreateApiKey(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	var reqBody struct {
		Name string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "Invalid request body"})
		return
	}

	newAPIKey := APIKey{
		ID:        generateRandomString(20),
		UserID:    userID,
		Name:      reqBody.Name,
		Key:       generateRandomString(40), // In a real app, this would be hashed and only a prefix stored
		CreatedAt: time.Now().Unix(),
		LastUsed:  0,
	}
	apiKeys[newAPIKey.ID] = newAPIKey
	auditLog = append(auditLog, AuditLogEntry{ID: generateRandomString(10), UserID: userID, Action: "API Key Created", Details: fmt.Sprintf("API Key Name: %s", newAPIKey.Name), Timestamp: time.Now().Unix()})

	writeJSON(w, http.StatusCreated, map[string]interface{}{"ok": true, "api_key": newAPIKey})
}

// handleRevokeApiKey revokes a specific API key
func handleRevokeApiKey(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	apiKeyID := r.PathValue("id")

	if apiKey, ok := apiKeys[apiKeyID]; ok && apiKey.UserID == userID {
		delete(apiKeys, apiKeyID)
		auditLog = append(auditLog, AuditLogEntry{ID: generateRandomString(10), UserID: userID, Action: "API Key Revoked", Details: fmt.Sprintf("API Key ID: %s", apiKeyID), Timestamp: time.Now().Unix()})
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "message": "API key revoked"})
		return
	}

	writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": "API key not found or unauthorized"})
}

// handleListApiKeys lists API keys for a user
func handleListApiKeys(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	userApiKeys := []APIKey{}
	for _, apiKey := range apiKeys {
		if apiKey.UserID == userID {
			userApiKeys = append(userApiKeys, apiKey)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "api_keys": userApiKeys})
}

// ---- Hosting Provider Handlers ----

// handleHostingerConnect connects to Hostinger API
func handleHostingerConnect(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	var reqBody struct {
		APIKey string `json:"api_key"`
	}

	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "Invalid request body"})
		return
	}

	// Simulate API key validation with Hostinger
	if reqBody.APIKey == "test_hostinger_key" {
		hostingerConfigs[userID] = HostingerConfig{UserID: userID, APIKey: reqBody.APIKey, Connected: true}
		auditLog = append(auditLog, AuditLogEntry{ID: generateRandomString(10), UserID: userID, Action: "Hostinger Connected", Details: "", Timestamp: time.Now().Unix()})
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "message": "Hostinger connected successfully"})
		return
	}

	writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": "Invalid Hostinger API key"})
}

// handleListHostingerVps lists Hostinger VPS instances for a user
func handleListHostingerVps(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	if config, ok := hostingerConfigs[userID]; ok && config.Connected {
		// Simulate fetching VPS list from Hostinger API
		vpsList := []HostingerVPS{
			{ID: "hvps-1", Name: "Harbinger-Agent-1", Status: "running", IPAddress: "192.168.1.100", Plan: "VPS 1", Region: "Europe", Price: 5.99, CPU: 1, RAM: 1024, Disk: 20},
			{ID: "hvps-2", Name: "Harbinger-Agent-2", Status: "stopped", IPAddress: "192.168.1.101", Plan: "VPS 2", Region: "North America", Price: 9.99, CPU: 2, RAM: 2048, Disk: 40},
		}
		hostingerVpsList[userID] = vpsList
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "vps_list": vpsList})
		return
	}

	writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": "Hostinger not connected"})
}

// handleCreateHostingerVps creates a new Hostinger VPS instance
func handleCreateHostingerVps(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	var reqBody struct {
		Name   string `json:"name"`
		Plan   string `json:"plan"`
		Region string `json:"region"`
	}

	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "Invalid request body"})
		return
	}

	if config, ok := hostingerConfigs[userID]; ok && config.Connected {
		// Simulate creating VPS via Hostinger API
		newVPS := HostingerVPS{
			ID:        generateRandomString(10),
			Name:      reqBody.Name,
			Status:    "provisioning",
			IPAddress: "", // Will be assigned later
			Plan:      reqBody.Plan,
			Region:    reqBody.Region,
			Price:     12.99, // Dummy price
			CPU:       2,
			RAM:       2048,
			Disk:      40,
		}
		currentVpsList := hostingerVpsList[userID]
		hostingerVpsList[userID] = append(currentVpsList, newVPS)
		auditLog = append(auditLog, AuditLogEntry{ID: generateRandomString(10), UserID: userID, Action: "Hostinger VPS Created", Details: fmt.Sprintf("VPS Name: %s", newVPS.Name), Timestamp: time.Now().Unix()})
		writeJSON(w, http.StatusCreated, map[string]interface{}{"ok": true, "vps": newVPS})
		return
	}

	writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": "Hostinger not connected"})
}

// handleCloudflareConnect connects to Cloudflare API
func handleCloudflareConnect(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	var reqBody struct {
		APIToken string `json:"api_token"`
	}

	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "Invalid request body"})
		return
	}

	// Simulate API token validation with Cloudflare
	if reqBody.APIToken == "test_cloudflare_token" {
		cloudflareConfigs[userID] = CloudflareConfig{UserID: userID, APIToken: reqBody.APIToken, Connected: true}
		auditLog = append(auditLog, AuditLogEntry{ID: generateRandomString(10), UserID: userID, Action: "Cloudflare Connected", Details: "", Timestamp: time.Now().Unix()})
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "message": "Cloudflare connected successfully"})
		return
	}

	writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": "Invalid Cloudflare API token"})
}

// handleListCloudflareZones lists Cloudflare DNS zones for a user
func handleListCloudflareZones(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	if config, ok := cloudflareConfigs[userID]; ok && config.Connected {
		// Simulate fetching zones from Cloudflare API
		zones := []CloudflareZone{
			{ID: "cfzone-1", Name: "example.com"},
			{ID: "cfzone-2", Name: "harbinger.io"},
		}
		cloudflareZonesList[userID] = zones
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "zones": zones})
		return
	}

	writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": "Cloudflare not connected"})
}

// handleCreateCloudflareTunnel creates a new Cloudflare Tunnel
func handleCreateCloudflareTunnel(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	var reqBody struct {
		ZoneID string `json:"zone_id"`
		Name   string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "Invalid request body"})
		return
	}

	if config, ok := cloudflareConfigs[userID]; ok && config.Connected {
		// Simulate creating Cloudflare Tunnel
		auditLog = append(auditLog, AuditLogEntry{ID: generateRandomString(10), UserID: userID, Action: "Cloudflare Tunnel Created", Details: fmt.Sprintf("Zone ID: %s, Tunnel Name: %s", reqBody.ZoneID, reqBody.Name), Timestamp: time.Now().Unix()})
		writeJSON(w, http.StatusCreated, map[string]interface{}{"ok": true, "message": "Cloudflare Tunnel created successfully"})
		return
	}

	writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": "Cloudflare not connected"})
}

// handleConfigureCloudflareAccess configures Cloudflare Zero Trust Access
func handleConfigureCloudflareAccess(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	var reqBody struct {
		ZoneID string `json:"zone_id"`
		Policy string `json:"policy"`
	}

	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "Invalid request body"})
		return
	}

	if config, ok := cloudflareConfigs[userID]; ok && config.Connected {
		// Simulate configuring Zero Trust Access
		auditLog = append(auditLog, AuditLogEntry{ID: generateRandomString(10), UserID: userID, Action: "Cloudflare Zero Trust Configured", Details: fmt.Sprintf("Zone ID: %s, Policy: %s", reqBody.ZoneID, reqBody.Policy), Timestamp: time.Now().Unix()})
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "message": "Cloudflare Zero Trust Access configured successfully"})
		return
	}

	writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": "Cloudflare not connected"})
}

// handleGetCloudflareWafRules retrieves Cloudflare WAF rules
func handleGetCloudflareWafRules(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	if config, ok := cloudflareConfigs[userID]; ok && config.Connected {
		// Simulate fetching WAF rules
		wafRules := []string{"SQL Injection", "XSS Protection"}
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "waf_rules": wafRules})
		return
	}

	writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": "Cloudflare not connected"})
}

// ---- Proxy Management Handlers ----

// handleListProxies lists configured proxies for a user
func handleListProxies(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	userProxies := proxies[userID]
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "proxies": userProxies})
}

// handleAddProxy adds a new proxy for a user
func handleAddProxy(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	var reqBody Proxy
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "Invalid request body"})
		return
	}

	reqBody.ID = generateRandomString(10)
	reqBody.UserID = userID
	reqBody.Health = "unknown"
	proxies[userID] = append(proxies[userID], reqBody)
	auditLog = append(auditLog, AuditLogEntry{ID: generateRandomString(10), UserID: userID, Action: "Proxy Added", Details: fmt.Sprintf("Proxy Type: %s, Address: %s", reqBody.Type, reqBody.Address), Timestamp: time.Now().Unix()})

	writeJSON(w, http.StatusCreated, map[string]interface{}{"ok": true, "proxy": reqBody})
}

// handleTestProxyChain tests a proxy chain
func handleTestProxyChain(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	// Simulate testing proxy chain
	auditLog = append(auditLog, AuditLogEntry{ID: generateRandomString(10), UserID: userID, Action: "Proxy Chain Tested", Details: "", Timestamp: time.Now().Unix()})
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "message": "Proxy chain test initiated"})
}

// handleUpdateProxyChainOrder updates the proxy chain order
func handleUpdateProxyChainOrder(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r.Context())
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}

	var reqBody struct {
		Order          string `json:"order"`
		TorIntegration bool   `json:"tor_integration"`
	}

	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "Invalid request body"})
		return
	}

	proxyChainConfigs[userID] = ProxyChainConfig{UserID: userID, Order: reqBody.Order, TorIntegration: reqBody.TorIntegration}
	auditLog = append(auditLog, AuditLogEntry{ID: generateRandomString(10), UserID: userID, Action: "Proxy Chain Config Updated", Details: fmt.Sprintf("Order: %s, Tor Integration: %t", reqBody.Order, reqBody.TorIntegration), Timestamp: time.Now().Unix()})

	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "message": "Proxy chain configuration updated"})
}

func generateRandomString(length int) string {
	b := make([]byte, length)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)[:length]
}

// ---- Dashboard ----

func handleDashboardStats(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"agents":     map[string]int{"total": 0, "online": 0, "offline": 0, "busy": 0},
		"containers": map[string]int{"total": 0, "running": 0, "stopped": 0},
		"browsers":   map[string]int{"total": 0, "active": 0},
		"workflows":  map[string]int{"total": 0, "running": 0, "completed": 0, "failed": 0},
	})
}

func handleDashboardActivity(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, []interface{}{})
}

func handleDashboardHealth(w http.ResponseWriter, r *http.Request) {
	type svcHealth struct {
		Name    string `json:"name"`
		Status  string `json:"status"`
		URL     string `json:"url,omitempty"`
		Latency int64  `json:"latency,omitempty"`
		Fix     string `json:"fix,omitempty"`
	}

	services := []struct {
		name string
		url  string
		fix  string
	}{
		{"HexStrike AI", cfg.HexStrikeURL, "Set HEXSTRIKE_URL in .env"},
		{"PentAGI", cfg.PentagiURL, "Set PENTAGI_URL in .env"},
		{"Red Team Ops", cfg.RedteamURL, "Set REDTEAM_URL in .env"},
		{"MCP Visualizer", cfg.MCPUIURL, "Set MCP_UI_URL in .env"},
		{"Browser Service", cfg.BrowserURL, "Set BROWSER_SERVICE_URL in .env"},
	}

	results := []svcHealth{}
	for _, svc := range services {
		status, latency := probeService(svc.url)
		h := svcHealth{Name: svc.name, Status: status, URL: svc.url, Latency: latency}
		if status == "not_configured" {
			h.Fix = svc.fix
		}
		results = append(results, h)
	}
	writeJSON(w, http.StatusOK, results)
}

// ---- Docker ----

func handleDockerContainers(w http.ResponseWriter, r *http.Request) {
	if !dockerAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
			"ok":     false,
			"reason": "not_configured",
			"fix":    "Mount /var/run/docker.sock into the backend container",
		})
		return
	}

	if r.Method == http.MethodPost {
		handleCreateContainer(w, r)
		return
	}

	resp, err := dockerAPIRequest("GET", "/v1.41/containers/json?all=true", nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"ok": false, "error": err.Error(),
		})
		return
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

func handleCreateContainer(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":      fmt.Sprintf("container-%d", time.Now().UnixMilli()),
		"message": "Container creation via API not yet implemented",
	})
}

func handleContainerAction(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	action := r.PathValue("action")

	if id == "" || action == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"ok": false, "error": "missing id or action",
		})
		return
	}

	if !dockerAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"ok": false, "reason": "not_configured",
		})
		return
	}

	endpoint := fmt.Sprintf("/v1.41/containers/%s/%s", id, action)
	resp, err := dockerAPIRequest("POST", endpoint, nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		writeJSON(w, resp.StatusCode, map[string]any{"ok": false, "error": string(body)})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id, "action": action})
}

func handleContainerLogs(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"ok": false, "error": "missing id",
		})
		return
	}

	if !dockerAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"ok": false, "reason": "not_configured",
		})
		return
	}

	endpoint := fmt.Sprintf("/v1.41/containers/%s/logs?stdout=true&stderr=true&tail=100", id)
	resp, err := dockerAPIRequest("GET", endpoint, nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		writeJSON(w, resp.StatusCode, map[string]any{"ok": false, "error": string(body)})
		return
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

func handleDockerImages(w http.ResponseWriter, r *http.Request) {
	if !dockerAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
			"ok": false, "reason": "not_configured",
		})
		return
	}
	resp, err := dockerAPIRequest("GET", "/v1.41/images/json", nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

// ---- MCP Servers ----

func handleMCPServers(w http.ResponseWriter, r *http.Request) {
	type mcpServer struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		URL     string `json:"url"`
		Status  string `json:"status"`
		Latency int64  `json:"latency,omitempty"`
		Fix     string `json:"fix,omitempty"`
	}

	servers := []struct {
		id   string
		name string
		url  string
		fix  string
	}{
		{"hexstrike", "HexStrike AI", cfg.HexStrikeURL, "Set HEXSTRIKE_URL env var"},
		{"pentagi", "PentAGI", cfg.PentagiURL, "Set PENTAGI_URL env var"},
		{"redteam", "Red Team Ops", cfg.RedteamURL, "Set REDTEAM_URL env var"},
		{"mcp-ui", "MCP Visualizer", cfg.MCPUIURL, "Set MCP_UI_URL env var"},
	}

	results := []mcpServer{}
	for _, s := range servers {
		status, latency := probeService(s.url)
		ms := mcpServer{ID: s.id, Name: s.name, URL: s.url, Status: status, Latency: latency}
		if status == "not_configured" {
			ms.Fix = s.fix
		}
		results = append(results, ms)
	}
	writeJSON(w, http.StatusOK, results)
}

func probeService(serviceURL string) (string, int64) {
	if serviceURL == "" {
		return "not_configured", 0
	}

	start := time.Now()
	resp, err := http.Get(serviceURL + "/health") // Assuming a /health endpoint
	if err != nil {
		return "down", 0
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		latency := time.Since(start).Milliseconds()
		return "up", latency
	}

	return "down", 0
}

func dockerAPIRequest(method, path string, body io.Reader) (*http.Response, error) {
	host := "http://docker.sock"
	client := &http.Client{
		Transport: &http.Transport{
			DialContext: func(_ context.Context, _, _ string) (net.Conn, error) {
				return net.Dial("unix", cfg.DockerSocket)
			},
		},
	}

	req, err := http.NewRequest(method, host+path, body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")

	return client.Do(req)
}

func dockerAvailable() bool {
	// Check if the docker socket exists
	if _, err := os.Stat(cfg.DockerSocket); os.IsNotExist(err) {
		return false
	}

	// Try to make a simple request to the Docker API
	resp, err := dockerAPIRequest("GET", "/v1.41/version", nil)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}

// Placeholder for other handlers
func handleListVPSNodes(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, vpsNodes)
}

func handleCreateVPSNode(w http.ResponseWriter, r *http.Request) {
	var vps VPSNode
	json.NewDecoder(r.Body).Decode(&vps)
	vps.ID = fmt.Sprintf("vps-%d", time.Now().UnixMilli())
	vpsNodes = append(vpsNodes, vps)
	writeJSON(w, http.StatusCreated, vps)
}

func handleListC2Servers(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, c2Servers)
}

func handleCreateC2Server(w http.ResponseWriter, r *http.Request) {
	var c2 C2Server
	json.NewDecoder(r.Body).Decode(&c2)
	c2.ID = fmt.Sprintf("c2-%d", time.Now().UnixMilli())
	c2Servers = append(c2Servers, c2)
	writeJSON(w, http.StatusCreated, c2)
}

func handleListImplants(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, implants)
}

func handleCreateImplant(w http.ResponseWriter, r *http.Request) {
	var implant Implant
	json.NewDecoder(r.Body).Decode(&implant)
	implant.ID = fmt.Sprintf("implant-%d", time.Now().UnixMilli())
	implants = append(implants, implant)
	writeJSON(w, http.StatusCreated, implant)
}

func handleListPlaybooks(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, playbooks)
}

func handleGetPlaybook(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	for _, pb := range playbooks {
		if pb.ID == id {
			writeJSON(w, http.StatusOK, pb)
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]string{"error": "Playbook not found"})
}
