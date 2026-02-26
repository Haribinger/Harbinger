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
	"sync"
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

// agentContainers tracks running agent Docker container IDs by agent DB ID.
var agentContainers = struct {
	sync.RWMutex
	m map[string]string // agentID -> containerID
}{m: make(map[string]string)}

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
	GitHubRedirectURL  string
	GitHubToken        string // GH_TOKEN — preloaded gh CLI token for direct auth
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
		GitHubToken:        getEnv("GH_TOKEN", ""),
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
	// Ensure GitHub OAuth is configured
	if cfg.GitHubClientID == "" || cfg.GitHubClientSecret == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"ok":     false,
			"error":  "not_configured",
			"reason": "GitHub OAuth is not configured on the server",
			"fix":    "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables",
		})
		return
	}

	// Generate a random state value (stored in JWT later; no server-side session needed for now)
	state := generateRandomString(32)

	// Build the GitHub authorization URL
	params := url.Values{}
	params.Set("client_id", cfg.GitHubClientID)
	params.Set("redirect_uri", cfg.GitHubRedirectURL)
	params.Set("scope", "read:user user:email")
	params.Set("state", state)

	authURL := "https://github.com/login/oauth/authorize?" + params.Encode()

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"auth_url": authURL,
		"state":    state,
	})
}

func handleGitHubCallback(w http.ResponseWriter, r *http.Request) {
	// If user denied access, GitHub sends ?error=access_denied
	if errParam := r.URL.Query().Get("error"); errParam != "" {
		redirectURL := fmt.Sprintf("%s/login?error=%s", cfg.AppURL, url.QueryEscape(errParam))
		http.Redirect(w, r, redirectURL, http.StatusFound)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		redirectURL := fmt.Sprintf("%s/login?error=no_code", cfg.AppURL)
		http.Redirect(w, r, redirectURL, http.StatusFound)
		return
	}

	// Exchange code for access token
	tokenResp, err := exchangeGitHubCode(code)
	if err != nil {
		log.Printf("GitHub token exchange failed: %v", err)
		redirectURL := fmt.Sprintf("%s/login?error=token_exchange_failed", cfg.AppURL)
		http.Redirect(w, r, redirectURL, http.StatusFound)
		return
	}

	// Fetch GitHub user profile
	user, err := getGitHubUser(tokenResp.AccessToken)
	if err != nil {
		log.Printf("GitHub user fetch failed: %v", err)
		redirectURL := fmt.Sprintf("%s/login?error=user_fetch_failed", cfg.AppURL)
		http.Redirect(w, r, redirectURL, http.StatusFound)
		return
	}

	// Generate JWT for Harbinger session
	token, err := generateJWT(fmt.Sprintf("%d", user.ID), user.Login, user.Email, "github")
	if err != nil {
		log.Printf("JWT generation failed: %v", err)
		redirectURL := fmt.Sprintf("%s/login?error=token_generation_failed", cfg.AppURL)
		http.Redirect(w, r, redirectURL, http.StatusFound)
		return
	}

	// Redirect back to frontend login with token in query string
	redirectURL := fmt.Sprintf("%s/login?token=%s", cfg.AppURL, url.QueryEscape(token))
	http.Redirect(w, r, redirectURL, http.StatusFound)
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

// ---- GitHub Device Flow + Token Auth ----

type DeviceFlowStartResponse struct {
	DeviceCode      string `json:"device_code"`
	UserCode        string `json:"user_code"`
	VerificationURI string `json:"verification_uri"`
	ExpiresIn       int    `json:"expires_in"`
	Interval        int    `json:"interval"`
}

type DeviceFlowPollRequest struct {
	DeviceCode string `json:"device_code"`
}

// issueJWTFromGitHubToken validates an access token with GitHub and returns a signed Harbinger JWT.
func issueJWTFromGitHubToken(accessToken string) (string, error) {
	user, err := getGitHubUser(accessToken)
	if err != nil {
		return "", fmt.Errorf("github user fetch: %w", err)
	}
	return generateJWT(fmt.Sprintf("%d", user.ID), user.Login, user.Email, "github")
}

// handleDeviceFlowStart initiates GitHub Device Flow and returns the user_code + verification_uri.
// The client displays the code and polls /api/auth/github/device/poll until authorized.
func handleDeviceFlowStart(w http.ResponseWriter, r *http.Request) {
	if cfg.GitHubClientID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"ok":     false,
			"error":  "not_configured",
			"reason": "GITHUB_CLIENT_ID not set on server",
		})
		return
	}

	data := url.Values{}
	data.Set("client_id", cfg.GitHubClientID)
	data.Set("scope", "read:user,user:email")

	req, err := http.NewRequest("POST", "https://github.com/login/device/code", strings.NewReader(data.Encode()))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": "GitHub unreachable: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	var flow DeviceFlowStartResponse
	if err := json.NewDecoder(resp.Body).Decode(&flow); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": "bad response from GitHub"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":               true,
		"device_code":      flow.DeviceCode,
		"user_code":        flow.UserCode,
		"verification_uri": flow.VerificationURI,
		"expires_in":       flow.ExpiresIn,
		"interval":         flow.Interval,
	})
}

// handleDeviceFlowPoll polls GitHub for a token after the user has entered their code.
// Returns {"ok":true,"jwt":"..."} on success or {"ok":false,"pending":true} while waiting.
func handleDeviceFlowPoll(w http.ResponseWriter, r *http.Request) {
	var req DeviceFlowPollRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.DeviceCode == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "device_code required"})
		return
	}

	data := url.Values{}
	data.Set("client_id", cfg.GitHubClientID)
	data.Set("device_code", req.DeviceCode)
	data.Set("grant_type", "urn:ietf:params:oauth:grant-type:device_code")

	httpReq, err := http.NewRequest("POST", "https://github.com/login/oauth/access_token", strings.NewReader(data.Encode()))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": "GitHub unreachable"})
		return
	}
	defer resp.Body.Close()

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": "bad response from GitHub"})
		return
	}

	// authorization_pending and slow_down are expected while user hasn't approved yet
	if tokenResp.Error != "" {
		pending := tokenResp.Error == "authorization_pending" || tokenResp.Error == "slow_down"
		writeJSON(w, http.StatusOK, map[string]any{"ok": false, "pending": pending, "error": tokenResp.Error})
		return
	}

	jwt, err := issueJWTFromGitHubToken(tokenResp.AccessToken)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "jwt": jwt})
}

// handleGitHubTokenAuth accepts a GitHub PAT or OAuth token and issues a Harbinger JWT.
func handleGitHubTokenAuth(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Token == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "token required"})
		return
	}

	jwt, err := issueJWTFromGitHubToken(body.Token)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "jwt": jwt})
}

// handleGitHubTokenFromEnv uses the GH_TOKEN env var as a shortcut for local dev.
func handleGitHubTokenFromEnv(w http.ResponseWriter, r *http.Request) {
	if cfg.GitHubToken == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"ok":    false,
			"error": "GH_TOKEN not set on server",
			"fix":   "Set GH_TOKEN environment variable",
		})
		return
	}

	jwt, err := issueJWTFromGitHubToken(cfg.GitHubToken)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "jwt": jwt})
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

// loadDotEnv parses a .env file and sets env vars that aren't already set.
// Existing process env vars (e.g., from Docker) always win.
func loadDotEnv(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		// Strip surrounding quotes (single or double)
		if len(val) >= 2 {
			if (val[0] == '"' && val[len(val)-1] == '"') || (val[0] == '\'' && val[len(val)-1] == '\'') {
				val = val[1 : len(val)-1]
			}
		}
		// Docker-injected vars always take precedence
		if os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
}

func handleSetupStatus(w http.ResponseWriter, r *http.Request) {
	githubOK := cfg.GitHubClientID != "" && cfg.GitHubClientSecret != ""
	jwtOK := cfg.JWTSecret != "change-me-in-production"
	// Setup is needed only if GitHub OAuth AND a GH_TOKEN are both missing — user has no way to log in
	hasAnyAuth := githubOK || cfg.GitHubToken != ""
	writeJSON(w, http.StatusOK, map[string]any{
		"needsSetup": !hasAnyAuth,
		"configured": map[string]any{
			"github":   githubOK,
			"ghToken":  cfg.GitHubToken != "",
			"database": cfg.DBHost != "",
			"jwt":      jwtOK,
		},
	})
}

// handleSetup accepts the setup wizard submission and applies configuration.
func handleSetup(w http.ResponseWriter, r *http.Request) {
	var body struct {
		AppName            string `json:"appName"`
		AppURL             string `json:"appUrl"`
		GitHubClientID     string `json:"githubClientId"`
		GitHubClientSecret string `json:"githubClientSecret"`
		AdminEmail         string `json:"adminEmail"`
		AdminPassword      string `json:"adminPassword"`
		GitHubPat          string `json:"githubPat"`
		GitHubOwner        string `json:"githubOwner"`
		GitHubRepo         string `json:"githubRepo"`
		LLMProvider        string `json:"llmProvider"`
		LLMApiKey          string `json:"llmApiKey"`
		LLMModel           string `json:"llmModel"`
		OllamaURL          string `json:"ollamaUrl"`
		DiscordBotToken    string `json:"discordBotToken"`
		DiscordGuildID     string `json:"discordGuildId"`
		DiscordChannelID   string `json:"discordChannelId"`
		TelegramBotToken   string `json:"telegramBotToken"`
		TelegramChatID     string `json:"telegramChatId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request body"})
		return
	}

	// Apply configuration to running server
	if body.GitHubClientID != "" {
		cfg.GitHubClientID = body.GitHubClientID
		os.Setenv("GITHUB_CLIENT_ID", body.GitHubClientID)
	}
	if body.GitHubClientSecret != "" {
		cfg.GitHubClientSecret = body.GitHubClientSecret
		os.Setenv("GITHUB_CLIENT_SECRET", body.GitHubClientSecret)
	}
	if body.AppURL != "" {
		cfg.AppURL = body.AppURL
		cfg.GitHubRedirectURL = body.AppURL + "/api/auth/github/callback"
		os.Setenv("APP_URL", body.AppURL)
	}
	if body.GitHubPat != "" {
		cfg.GitHubToken = body.GitHubPat
		os.Setenv("GH_TOKEN", body.GitHubPat)
	}

	// Write to .env file so settings survive restarts
	envLines := []string{}
	if body.AppName != "" {
		envLines = append(envLines, fmt.Sprintf("APP_NAME=%s", body.AppName))
	}
	if body.AppURL != "" {
		envLines = append(envLines, fmt.Sprintf("APP_URL=%s", body.AppURL))
	}
	if body.GitHubClientID != "" {
		envLines = append(envLines, fmt.Sprintf("GITHUB_CLIENT_ID=%s", body.GitHubClientID))
	}
	if body.GitHubClientSecret != "" {
		envLines = append(envLines, fmt.Sprintf("GITHUB_CLIENT_SECRET=%s", body.GitHubClientSecret))
	}
	if body.GitHubPat != "" {
		envLines = append(envLines, fmt.Sprintf("GH_TOKEN=%s", body.GitHubPat))
	}
	if body.LLMProvider != "" {
		envLines = append(envLines, fmt.Sprintf("LLM_PROVIDER=%s", body.LLMProvider))
	}
	if body.LLMApiKey != "" {
		keyVar := "ANTHROPIC_API_KEY"
		switch body.LLMProvider {
		case "openai":
			keyVar = "OPENAI_API_KEY"
		case "google", "gemini":
			keyVar = "GOOGLE_API_KEY"
		case "groq":
			keyVar = "GROQ_API_KEY"
		case "mistral":
			keyVar = "MISTRAL_API_KEY"
		case "ollama":
			keyVar = "" // Ollama needs no key
		}
		if keyVar != "" {
			envLines = append(envLines, fmt.Sprintf("%s=%s", keyVar, body.LLMApiKey))
		}
	}
	if body.OllamaURL != "" {
		envLines = append(envLines, fmt.Sprintf("OLLAMA_URL=%s", body.OllamaURL))
	}

	// Channel configs
	if body.DiscordBotToken != "" {
		envLines = append(envLines, fmt.Sprintf("DISCORD_BOT_TOKEN=%s", body.DiscordBotToken))
		channelCfgMu.Lock()
		channelCfg.Discord.BotToken = body.DiscordBotToken
		channelCfg.Discord.Enabled = true
		channelCfg.Discord.Status = "connected"
		channelCfgMu.Unlock()
		os.Setenv("DISCORD_BOT_TOKEN", body.DiscordBotToken)
	}
	if body.DiscordGuildID != "" {
		envLines = append(envLines, fmt.Sprintf("DISCORD_GUILD_ID=%s", body.DiscordGuildID))
		channelCfgMu.Lock()
		channelCfg.Discord.GuildID = body.DiscordGuildID
		channelCfgMu.Unlock()
	}
	if body.DiscordChannelID != "" {
		envLines = append(envLines, fmt.Sprintf("DISCORD_CHANNEL_ID=%s", body.DiscordChannelID))
		channelCfgMu.Lock()
		channelCfg.Discord.ChannelID = body.DiscordChannelID
		channelCfgMu.Unlock()
	}
	if body.TelegramBotToken != "" {
		envLines = append(envLines, fmt.Sprintf("TELEGRAM_BOT_TOKEN=%s", body.TelegramBotToken))
		channelCfgMu.Lock()
		channelCfg.Telegram.BotToken = body.TelegramBotToken
		channelCfg.Telegram.Enabled = true
		channelCfg.Telegram.Status = "connected"
		channelCfgMu.Unlock()
		os.Setenv("TELEGRAM_BOT_TOKEN", body.TelegramBotToken)
	}
	if body.TelegramChatID != "" {
		envLines = append(envLines, fmt.Sprintf("TELEGRAM_CHAT_ID=%s", body.TelegramChatID))
		channelCfgMu.Lock()
		channelCfg.Telegram.ChatID = body.TelegramChatID
		channelCfgMu.Unlock()
	}

	if len(envLines) > 0 {
		// Append to .env (don't overwrite existing entries)
		envPath := ".env"
		if _, err := os.Stat("../../.env"); err == nil {
			envPath = "../../.env"
		}
		f, err := os.OpenFile(envPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
		if err == nil {
			f.WriteString("\n# Added by setup wizard\n")
			for _, line := range envLines {
				f.WriteString(line + "\n")
			}
			f.Close()
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Setup complete"})
}

func main() {
	// Load .env for local dev (Docker passes env vars directly, so these are no-ops in Docker)
	loadDotEnv(".env")
	loadDotEnv("../../.env")

	cfg = loadConfig()

	// Initialize PostgreSQL (falls back to in-memory if unavailable)
	initDB(cfg)
	if dbAvailable() {
		seedDefaultAgents()
	}

	// Initialize channel configs from env
	initChannels()

	mux := http.NewServeMux()

	// Public routes
	mux.HandleFunc("GET /", handleHome)
	mux.HandleFunc("GET /health", handleHealthCheck)
	mux.HandleFunc("GET /api/v1/health", handleHealthCheck)
	mux.HandleFunc("GET /api/setup/status", handleSetupStatus)
	mux.HandleFunc("POST /api/setup", handleSetup)
	// GitHub OAuth endpoints
	mux.HandleFunc("GET /api/auth/github", handleGitHubLogin)
	mux.HandleFunc("GET /api/auth/github/login", handleGitHubLogin)
	mux.HandleFunc("GET /api/auth/github/callback", handleGitHubCallback)
	mux.HandleFunc("POST /api/auth/github/device/start", handleDeviceFlowStart)
	mux.HandleFunc("POST /api/auth/github/device/poll", handleDeviceFlowPoll)
	mux.HandleFunc("POST /api/auth/github/token", handleGitHubTokenAuth)
	mux.HandleFunc("GET /api/auth/github/token/env", handleGitHubTokenFromEnv)

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
	mux.HandleFunc("GET /api/v1/docker/containers/{id}/stats", authMiddleware(handleDockerContainerStats))
	mux.HandleFunc("GET /api/v1/docker/containers/{id}/inspect", authMiddleware(handleDockerContainerInspect))
	mux.HandleFunc("DELETE /api/v1/docker/containers/{id}", authMiddleware(handleDockerDeleteContainer))
	mux.HandleFunc("POST /api/v1/docker/images/pull", authMiddleware(handleDockerPullImage))
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

	// Agent CRUD (v1)
	mux.HandleFunc("GET /api/v1/agents", authMiddleware(handleListAgents))
	mux.HandleFunc("POST /api/v1/agents", authMiddleware(handleCreateAgent))
	mux.HandleFunc("GET /api/v1/agents/{id}", authMiddleware(handleGetAgentByID))
	mux.HandleFunc("PATCH /api/v1/agents/{id}", authMiddleware(handleUpdateAgentByID))
	mux.HandleFunc("DELETE /api/v1/agents/{id}", authMiddleware(handleDeleteAgentByID))
	mux.HandleFunc("POST /api/v1/agents/{id}/spawn", authMiddleware(handleSpawnAgent))
	mux.HandleFunc("POST /api/v1/agents/{id}/stop", authMiddleware(handleStopAgent))
	mux.HandleFunc("GET /api/v1/agents/{id}/status", authMiddleware(handleAgentStatus))
	mux.HandleFunc("GET /api/v1/agents/{id}/logs", authMiddleware(handleAgentLogs))
	mux.HandleFunc("POST /api/v1/agents/{id}/heartbeat", authMiddleware(handleAgentHeartbeat))
	mux.HandleFunc("POST /api/v1/agents/{id}/clone", authMiddleware(handleCloneAgent))
	mux.HandleFunc("GET /api/v1/agents/templates", authMiddleware(handleGetAgentTemplates))

	// Jobs (v1)
	mux.HandleFunc("GET /api/v1/jobs", authMiddleware(handleListJobs))
	mux.HandleFunc("POST /api/v1/jobs", authMiddleware(handleCreateJob))
	mux.HandleFunc("PATCH /api/v1/jobs/{id}", authMiddleware(handleUpdateJob))

	// Workflows (v1)
	mux.HandleFunc("GET /api/v1/workflows", authMiddleware(handleListWorkflows))
	mux.HandleFunc("POST /api/v1/workflows", authMiddleware(handleCreateWorkflowAPI))
	mux.HandleFunc("PATCH /api/v1/workflows/{id}", authMiddleware(handleUpdateWorkflowAPI))
	mux.HandleFunc("DELETE /api/v1/workflows/{id}", authMiddleware(handleDeleteWorkflowAPI))

	// Non-v1 aliases for frontend API calls (frontend uses /api/X, not /api/v1/X)
	// Dashboard
	mux.HandleFunc("GET /api/dashboard/stats", authMiddleware(handleDashboardStats))
	mux.HandleFunc("GET /api/dashboard/activity", authMiddleware(handleDashboardActivity))
	mux.HandleFunc("GET /api/dashboard/health", authMiddleware(handleDashboardHealth))
	// Docker
	mux.HandleFunc("GET /api/docker/containers", authMiddleware(handleDockerContainers))
	mux.HandleFunc("POST /api/docker/containers", authMiddleware(handleCreateContainer))
	mux.HandleFunc("POST /api/docker/containers/{id}/{action}", authMiddleware(handleContainerAction))
	mux.HandleFunc("GET /api/docker/containers/{id}/logs", authMiddleware(handleContainerLogs))
	mux.HandleFunc("GET /api/docker/images", authMiddleware(handleDockerImages))
	// MCP
	mux.HandleFunc("GET /api/mcp", authMiddleware(handleMCPServers))
	mux.HandleFunc("GET /api/mcp/servers", authMiddleware(handleMCPServers))
	// Enhanced Docker endpoints
	mux.HandleFunc("GET /api/docker/containers/{id}/stats", authMiddleware(handleDockerContainerStats))
	mux.HandleFunc("GET /api/docker/containers/{id}/inspect", authMiddleware(handleDockerContainerInspect))
	mux.HandleFunc("DELETE /api/docker/containers/{id}", authMiddleware(handleDockerDeleteContainer))
	mux.HandleFunc("POST /api/docker/images/pull", authMiddleware(handleDockerPullImage))
	// VPS / C2 / Implants / Playbooks
	mux.HandleFunc("GET /api/vps", authMiddleware(handleListVPSNodes))
	mux.HandleFunc("POST /api/vps", authMiddleware(handleCreateVPSNode))
	mux.HandleFunc("GET /api/c2", authMiddleware(handleListC2Servers))
	mux.HandleFunc("POST /api/c2", authMiddleware(handleCreateC2Server))
	mux.HandleFunc("GET /api/implants", authMiddleware(handleListImplants))
	mux.HandleFunc("POST /api/implants", authMiddleware(handleCreateImplant))
	mux.HandleFunc("GET /api/playbooks", authMiddleware(handleListPlaybooks))
	mux.HandleFunc("GET /api/playbooks/{id}", authMiddleware(handleGetPlaybook))
	// Proxies
	mux.HandleFunc("GET /api/security/proxies", authMiddleware(handleListProxies))
	mux.HandleFunc("POST /api/security/proxies", authMiddleware(handleAddProxy))
	mux.HandleFunc("POST /api/security/proxies/test", authMiddleware(handleTestProxyChain))
	mux.HandleFunc("PUT /api/security/proxies/chain", authMiddleware(handleUpdateProxyChainOrder))
	// Auth (non-v1)
	mux.HandleFunc("GET /api/auth/sessions", authMiddleware(handleListSessions))
	mux.HandleFunc("GET /api/auth/audit", authMiddleware(handleGetAuditLog))
	mux.HandleFunc("GET /api/auth/apikeys", authMiddleware(handleListApiKeys))
	mux.HandleFunc("POST /api/auth/apikeys", authMiddleware(handleCreateApiKey))
	// Agents (non-v1)
	mux.HandleFunc("GET /api/agents", authMiddleware(handleListAgents))
	mux.HandleFunc("POST /api/agents", authMiddleware(handleCreateAgent))
	mux.HandleFunc("GET /api/agents/{id}", authMiddleware(handleGetAgentByID))
	mux.HandleFunc("PATCH /api/agents/{id}", authMiddleware(handleUpdateAgentByID))
	mux.HandleFunc("DELETE /api/agents/{id}", authMiddleware(handleDeleteAgentByID))
	mux.HandleFunc("POST /api/agents/{id}/spawn", authMiddleware(handleSpawnAgent))
	mux.HandleFunc("POST /api/agents/{id}/stop", authMiddleware(handleStopAgent))
	mux.HandleFunc("GET /api/agents/{id}/status", authMiddleware(handleAgentStatus))
	mux.HandleFunc("GET /api/agents/{id}/logs", authMiddleware(handleAgentLogs))
	mux.HandleFunc("POST /api/agents/{id}/heartbeat", authMiddleware(handleAgentHeartbeat))
	mux.HandleFunc("POST /api/agents/{id}/clone", authMiddleware(handleCloneAgent))
	mux.HandleFunc("GET /api/agents/templates", authMiddleware(handleGetAgentTemplates))
	// Jobs (non-v1)
	mux.HandleFunc("GET /api/jobs", authMiddleware(handleListJobs))
	mux.HandleFunc("POST /api/jobs", authMiddleware(handleCreateJob))
	mux.HandleFunc("PATCH /api/jobs/{id}", authMiddleware(handleUpdateJob))
	// Workflows (non-v1)
	mux.HandleFunc("GET /api/workflows", authMiddleware(handleListWorkflows))
	mux.HandleFunc("POST /api/workflows", authMiddleware(handleCreateWorkflowAPI))
	mux.HandleFunc("PATCH /api/workflows/{id}", authMiddleware(handleUpdateWorkflowAPI))
	mux.HandleFunc("DELETE /api/workflows/{id}", authMiddleware(handleDeleteWorkflowAPI))

	// OpenClaw Integration
	mux.HandleFunc("GET /api/openclaw/status", authMiddleware(handleOpenClawStatus))
	mux.HandleFunc("POST /api/openclaw/webhook", handleOpenClawWebhook) // No auth — external webhook
	mux.HandleFunc("POST /api/openclaw/command", authMiddleware(handleOpenClawCommand))
	mux.HandleFunc("GET /api/openclaw/skills", authMiddleware(handleOpenClawSkills))
	mux.HandleFunc("POST /api/openclaw/connect", authMiddleware(handleOpenClawConnect))
	mux.HandleFunc("GET /api/openclaw/events", authMiddleware(handleOpenClawEvents))
	mux.HandleFunc("POST /api/openclaw/ping", handleOpenClawPing) // No auth — gateway keepalive
	// v1 aliases
	mux.HandleFunc("GET /api/v1/openclaw/status", authMiddleware(handleOpenClawStatus))
	mux.HandleFunc("POST /api/v1/openclaw/webhook", handleOpenClawWebhook)
	mux.HandleFunc("POST /api/v1/openclaw/command", authMiddleware(handleOpenClawCommand))
	mux.HandleFunc("GET /api/v1/openclaw/skills", authMiddleware(handleOpenClawSkills))
	mux.HandleFunc("POST /api/v1/openclaw/connect", authMiddleware(handleOpenClawConnect))
	mux.HandleFunc("GET /api/v1/openclaw/events", authMiddleware(handleOpenClawEvents))
	mux.HandleFunc("POST /api/v1/openclaw/ping", handleOpenClawPing)

	// Agent Communication Bus
	mux.HandleFunc("POST /api/agents/broadcast", authMiddleware(handleAgentBroadcast))
	mux.HandleFunc("GET /api/agents/messages", authMiddleware(handleGetAgentMessages))
	mux.HandleFunc("GET /api/agents/context", authMiddleware(handleGetSharedContext))
	mux.HandleFunc("POST /api/v1/agents/broadcast", authMiddleware(handleAgentBroadcast))
	mux.HandleFunc("GET /api/v1/agents/messages", authMiddleware(handleGetAgentMessages))
	mux.HandleFunc("GET /api/v1/agents/context", authMiddleware(handleGetSharedContext))

	// Channel User Context & Conversations
	mux.HandleFunc("POST /api/channels/user-context", authMiddleware(handleUpdateUserContext))
	mux.HandleFunc("GET /api/channels/user-context", authMiddleware(handleGetUserContext))
	mux.HandleFunc("GET /api/channels/conversations", authMiddleware(handleGetConversations))
	mux.HandleFunc("POST /api/channels/relay", authMiddleware(handleRelayMessage))
	mux.HandleFunc("POST /api/v1/channels/user-context", authMiddleware(handleUpdateUserContext))
	mux.HandleFunc("GET /api/v1/channels/user-context", authMiddleware(handleGetUserContext))
	mux.HandleFunc("GET /api/v1/channels/conversations", authMiddleware(handleGetConversations))
	mux.HandleFunc("POST /api/v1/channels/relay", authMiddleware(handleRelayMessage))

	// Channels (Discord, Telegram, Slack)
	mux.HandleFunc("GET /api/channels", authMiddleware(handleListChannels))
	mux.HandleFunc("POST /api/channels/discord", authMiddleware(handleConfigureDiscord))
	mux.HandleFunc("POST /api/channels/telegram", authMiddleware(handleConfigureTelegram))
	mux.HandleFunc("POST /api/channels/slack", authMiddleware(handleConfigureSlack))
	mux.HandleFunc("POST /api/channels/{channel}/test", authMiddleware(handleTestChannel))
	mux.HandleFunc("POST /api/channels/discord/webhook", handleDiscordWebhook)   // No auth — external
	mux.HandleFunc("POST /api/channels/telegram/webhook", handleTelegramWebhook) // No auth — external
	// v1 aliases
	mux.HandleFunc("GET /api/v1/channels", authMiddleware(handleListChannels))
	mux.HandleFunc("POST /api/v1/channels/discord", authMiddleware(handleConfigureDiscord))
	mux.HandleFunc("POST /api/v1/channels/telegram", authMiddleware(handleConfigureTelegram))
	mux.HandleFunc("POST /api/v1/channels/slack", authMiddleware(handleConfigureSlack))
	mux.HandleFunc("POST /api/v1/channels/{channel}/test", authMiddleware(handleTestChannel))

	// ── Browser Manager ──────────────────────────────────────────────────
	mux.HandleFunc("GET /api/browsers/sessions", authMiddleware(handleBrowserSessions))
	mux.HandleFunc("GET /api/browsers/agents", authMiddleware(handleBrowserAgentSessions))
	mux.HandleFunc("GET /api/browsers/stats", authMiddleware(handleBrowserStats))
	mux.HandleFunc("POST /api/browser/sessions", authMiddleware(handleCreateBrowserSession))
	mux.HandleFunc("DELETE /api/browser/sessions/{id}", authMiddleware(handleCloseBrowserSession))
	mux.HandleFunc("POST /api/browser/sessions/{id}/navigate", authMiddleware(handleBrowserNavigate))
	mux.HandleFunc("POST /api/browser/sessions/{id}/screenshot", authMiddleware(handleBrowserScreenshot))
	mux.HandleFunc("POST /api/browser/sessions/{id}/execute", authMiddleware(handleBrowserExecute))
	mux.HandleFunc("POST /api/browser/sessions/{id}/click", authMiddleware(handleBrowserClick))
	mux.HandleFunc("POST /api/browser/sessions/{id}/type", authMiddleware(handleBrowserType))
	mux.HandleFunc("GET /api/browser/sessions/{id}/console", authMiddleware(handleBrowserConsole))
	mux.HandleFunc("GET /api/browser/sessions/{id}/network", authMiddleware(handleBrowserNetwork))
	mux.HandleFunc("POST /api/browser/sessions/{id}/clear", authMiddleware(handleBrowserClear))
	mux.HandleFunc("GET /api/browser/sessions/{id}/elements", authMiddleware(handleBrowserElements))
	mux.HandleFunc("GET /api/browser/sessions/{id}/source", authMiddleware(handleBrowserSource))
	// v1 aliases
	mux.HandleFunc("GET /api/v1/browsers/sessions", authMiddleware(handleBrowserSessions))
	mux.HandleFunc("GET /api/v1/browsers/agents", authMiddleware(handleBrowserAgentSessions))
	mux.HandleFunc("GET /api/v1/browsers/stats", authMiddleware(handleBrowserStats))
	mux.HandleFunc("POST /api/v1/browser/sessions", authMiddleware(handleCreateBrowserSession))
	mux.HandleFunc("DELETE /api/v1/browser/sessions/{id}", authMiddleware(handleCloseBrowserSession))
	mux.HandleFunc("POST /api/v1/browser/sessions/{id}/navigate", authMiddleware(handleBrowserNavigate))
	mux.HandleFunc("POST /api/v1/browser/sessions/{id}/screenshot", authMiddleware(handleBrowserScreenshot))
	mux.HandleFunc("POST /api/v1/browser/sessions/{id}/execute", authMiddleware(handleBrowserExecute))
	mux.HandleFunc("POST /api/v1/browser/sessions/{id}/click", authMiddleware(handleBrowserClick))
	mux.HandleFunc("POST /api/v1/browser/sessions/{id}/type", authMiddleware(handleBrowserType))
	mux.HandleFunc("GET /api/v1/browser/sessions/{id}/console", authMiddleware(handleBrowserConsole))
	mux.HandleFunc("GET /api/v1/browser/sessions/{id}/network", authMiddleware(handleBrowserNetwork))
	mux.HandleFunc("POST /api/v1/browser/sessions/{id}/clear", authMiddleware(handleBrowserClear))
	mux.HandleFunc("GET /api/v1/browser/sessions/{id}/elements", authMiddleware(handleBrowserElements))
	mux.HandleFunc("GET /api/v1/browser/sessions/{id}/source", authMiddleware(handleBrowserSource))

	// ── Themes ──────────────────────────────────────────────────────────
	mux.HandleFunc("GET /api/themes", authMiddleware(handleGetThemes))
	mux.HandleFunc("POST /api/themes", authMiddleware(handleSaveTheme))
	mux.HandleFunc("DELETE /api/themes/{id}", authMiddleware(handleDeleteTheme))
	mux.HandleFunc("GET /api/themes/agent", authMiddleware(handleGetAgentThemes))
	mux.HandleFunc("POST /api/themes/agent", authMiddleware(handleSetAgentTheme))
	mux.HandleFunc("GET /api/themes/schedule", authMiddleware(handleGetThemeSchedule))
	mux.HandleFunc("POST /api/themes/schedule", authMiddleware(handleSetThemeSchedule))
	mux.HandleFunc("POST /api/themes/generate", authMiddleware(handleGenerateTheme))
	// v1 aliases
	mux.HandleFunc("GET /api/v1/themes", authMiddleware(handleGetThemes))
	mux.HandleFunc("POST /api/v1/themes", authMiddleware(handleSaveTheme))
	mux.HandleFunc("DELETE /api/v1/themes/{id}", authMiddleware(handleDeleteTheme))
	mux.HandleFunc("GET /api/v1/themes/agent", authMiddleware(handleGetAgentThemes))
	mux.HandleFunc("POST /api/v1/themes/agent", authMiddleware(handleSetAgentTheme))
	mux.HandleFunc("GET /api/v1/themes/schedule", authMiddleware(handleGetThemeSchedule))
	mux.HandleFunc("POST /api/v1/themes/schedule", authMiddleware(handleSetThemeSchedule))
	mux.HandleFunc("POST /api/v1/themes/generate", authMiddleware(handleGenerateTheme))

	log.Printf("Server starting on :%s\n", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, corsMiddleware(mux)))
}

func handleHome(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "Welcome to Harbinger API"})
}

func handleHealthCheck(w http.ResponseWriter, r *http.Request) {
	var checks []interface{}

	// Check database connection (real ping)
	dbStatus := "error"
	dbFix := "PostgreSQL not connected"
	if dbAvailable() {
		if err := db.Ping(); err == nil {
			dbStatus = "connected"
			dbFix = ""
		} else {
			dbFix = "PostgreSQL ping failed: " + err.Error()
		}
	} else {
		dbFix = "Set DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD in .env"
	}
	checks = append(checks, map[string]string{"id": "database", "name": "PostgreSQL", "status": dbStatus, "fix": dbFix})

	// Check Redis connection (still simulated — full Redis client not wired yet)
	redisStatus := "warning"
	redisFix := "Redis client not connected yet"
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

	if dbAvailable() {
		dbSessions, err := dbListSessions(userID)
		if err == nil {
			writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "sessions": dbSessions})
			return
		}
		log.Printf("[Sessions] DB error: %v, falling back to memory", err)
	}

	// In-memory fallback
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

	if dbAvailable() {
		if err := dbRevokeSession(sessionID, userID); err != nil {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"ok": false, "error": err.Error()})
			return
		}
		dbAddAuditEntry(userID, "session_revoked", "session", sessionID, nil, r.RemoteAddr)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "message": "Session revoked"})
		return
	}

	// In-memory fallback
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

	if dbAvailable() {
		entries, err := dbGetAuditLog(userID, 100)
		if err == nil {
			writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "audit_log": entries})
			return
		}
		log.Printf("[Audit] DB error: %v, falling back", err)
	}

	// In-memory fallback
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
	if dbAvailable() {
		stats, err := dbGetDashboardStats()
		if err == nil {
			writeJSON(w, http.StatusOK, stats)
			return
		}
		log.Printf("[Dashboard] DB stats error: %v, falling back", err)
	}
	// Fallback for no-DB mode — include real browser counts
	browserSessionsMu.RLock()
	totalBrowsers := len(browserSessions)
	activeBrowsers := 0
	for _, s := range browserSessions {
		if s.Status == "active" {
			activeBrowsers++
		}
	}
	browserSessionsMu.RUnlock()

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"agents":     map[string]int{"total": 0, "online": 0, "offline": 0, "busy": 0},
		"containers": map[string]int{"total": 0, "running": 0, "stopped": 0},
		"browsers":   map[string]int{"total": totalBrowsers, "active": activeBrowsers},
		"workflows":  map[string]int{"total": 0, "running": 0, "completed": 0, "failed": 0},
	})
}

func handleDashboardActivity(w http.ResponseWriter, r *http.Request) {
	if dbAvailable() {
		activity, err := dbGetRecentActivity(20)
		if err == nil {
			writeJSON(w, http.StatusOK, activity)
			return
		}
	}
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
