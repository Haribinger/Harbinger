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
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			writeJSON(w, http.StatusUnauthorized, map[string]interface{}{
				"ok":    false,
				"error": "Invalid authorization header format",
			})
			return
		}

		claims, err := validateJWT(parts[1])
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]interface{}{
				"ok":    false,
				"error": "Invalid or expired token",
			})
			return
		}

		// Add claims to context
		ctx := context.WithValue(r.Context(), "user", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

// ---- Service probe ----

func probeService(url string) (status string, latencyMs int64) {
	if url == "" {
		return "not_configured", 0
	}
	start := time.Now()
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(url + "/health")
	if err != nil {
		return "disconnected", 0
	}
	defer resp.Body.Close()
	latencyMs = time.Since(start).Milliseconds()
	if resp.StatusCode < 500 {
		return "connected", latencyMs
	}
	return "error", latencyMs
}

// ---- Docker socket client ----

func newDockerClient() *http.Client {
	return &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				return (&net.Dialer{}).DialContext(ctx, "unix", cfg.DockerSocket)
			},
		},
	}
}

func dockerAPIRequest(method, path string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(method, "http://docker"+path, body)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return newDockerClient().Do(req)
}

func dockerAvailable() bool {
	_, err := os.Stat(cfg.DockerSocket)
	return err == nil
}

// ---- Global config ----

var cfg Config

// ---- Health ----

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":        true,
		"status":    "healthy",
		"service":   "harbinger-backend",
		"version":   getEnv("VERSION", "1.0.0"),
		"env":       cfg.AppEnv,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "# HELP harbinger_up Harbinger backend up status\n")
	fmt.Fprintf(w, "# TYPE harbinger_up gauge\n")
	fmt.Fprintf(w, "harbinger_up 1\n")
	fmt.Fprintf(w, "# HELP harbinger_requests_total Total requests\n")
	fmt.Fprintf(w, "# TYPE harbinger_requests_total counter\n")
	fmt.Fprintf(w, "harbinger_requests_total 0\n")
}

// ---- Services ----

func handleServices(w http.ResponseWriter, r *http.Request) {
	services := []map[string]interface{}{
		{"id": "hexstrike", "name": "HexStrike AI", "url": cfg.HexStrikeURL, "enabled": cfg.HexStrikeURL != ""},
		{"id": "pentagi", "name": "PentAGI", "url": cfg.PentagiURL, "enabled": cfg.PentagiURL != ""},
		{"id": "redteam", "name": "Red Team Ops", "url": cfg.RedteamURL, "enabled": cfg.RedteamURL != ""},
		{"id": "mcp-ui", "name": "MCP Visualizer", "url": cfg.MCPUIURL, "enabled": cfg.MCPUIURL != ""},
		{"id": "browser", "name": "Browser Service", "url": cfg.BrowserURL, "enabled": cfg.BrowserURL != ""},
		{"id": "docker", "name": "Docker", "url": cfg.DockerSocket, "enabled": dockerAvailable()},
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"services": services})
}

func handleServicesCheck(w http.ResponseWriter, r *http.Request) {
	type result struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Status  string `json:"status"`
		Latency int64  `json:"latency,omitempty"`
		Fix     string `json:"fix,omitempty"`
	}
	checks := []result{}
	probeList := []struct {
		id   string
		name string
		url  string
		fix  string
	}{
		{"hexstrike", "HexStrike AI", cfg.HexStrikeURL, "Set HEXSTRIKE_URL env var"},
		{"pentagi", "PentAGI", cfg.PentagiURL, "Set PENTAGI_URL env var"},
		{"redteam", "Red Team Ops", cfg.RedteamURL, "Set REDTEAM_URL env var"},
		{"mcp-ui", "MCP Visualizer", cfg.MCPUIURL, "Set MCP_UI_URL env var"},
		{"browser", "Browser Service", cfg.BrowserURL, "Set BROWSER_SERVICE_URL env var"},
	}
	for _, p := range probeList {
		status, latency := probeService(p.url)
		r := result{ID: p.id, Name: p.name, Status: status, Latency: latency}
		if status == "not_configured" {
			r.Fix = p.fix
		}
		checks = append(checks, r)
	}
	// Docker
	dockerStatus := "disconnected"
	dockerFix := ""
	if dockerAvailable() {
		dockerStatus = "connected"
	} else {
		dockerFix = "Mount /var/run/docker.sock or set DOCKER_SOCKET env var"
	}
	checks = append(checks, result{ID: "docker", Name: "Docker", Status: dockerStatus, Fix: dockerFix})
	writeJSON(w, http.StatusOK, map[string]interface{}{"checks": checks})
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

func handleContainerAction(w http.ResponseWriter, r *http.Request, id, action string) {
	if !dockerAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
			"ok": false, "reason": "not_configured",
		})
		return
	}
	endpoint := fmt.Sprintf("/v1.41/containers/%s/%s", id, action)
	resp, err := dockerAPIRequest("POST", endpoint, nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}
	defer resp.Body.Close()
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "id": id, "action": action})
}

func handleContainerLogs(w http.ResponseWriter, r *http.Request, id string) {
	if !dockerAvailable() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
			"ok": false, "reason": "not_configured",
		})
		return
	}
	endpoint := fmt.Sprintf("/v1.41/containers/%s/logs?stdout=true&stderr=true&tail=100", id)
	resp, err := dockerAPIRequest("GET", endpoint, nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
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

	result := []mcpServer{}
	for _, s := range servers {
		status, latency := probeService(s.url)
		ms := mcpServer{ID: s.id, Name: s.name, URL: s.url, Status: status, Latency: latency}
		if status == "not_configured" {
			ms.Fix = s.fix
		}
		result = append(result, ms)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"servers": result,
		"total":   len(result),
		"enabled": cfg.MCPEnabled,
	})
}

// ---- Browsers ----

func handleBrowserSessions(w http.ResponseWriter, r *http.Request) {
	if cfg.BrowserURL == "" {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"ok":      false,
			"reason":  "not_configured",
			"fix":     "Set BROWSER_SERVICE_URL env var to your browser automation service",
			"sessions": []interface{}{},
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":       true,
		"sessions": []interface{}{},
	})
}

// ---- Agents ----

func handleAgents(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"agents": []interface{}{},
		"total":  0,
	})
}

// ---- Workflows ----

func handleWorkflows(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"workflows": []interface{}{},
		"total":     0,
	})
}

// ---- Bug Bounty Targets ----

func handleTargets(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"targets": []interface{}{},
		"total":   0,
	})
}

func handleCreateTarget(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = fmt.Sprintf("target-%d", time.Now().UnixMilli())
	body["created_at"] = time.Now().UTC().Format(time.RFC3339)
	writeJSON(w, http.StatusCreated, body)
}

// ---- Scans & Vulnerabilities ----

func handleScans(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"scans": []interface{}{},
		"total": 0,
	})
}

func handleVulnerabilities(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"vulnerabilities": []interface{}{},
		"total":           0,
		"by_severity": map[string]int{
			"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0,
		},
	})
}

// ---- Auth ----

func handleLogin(w http.ResponseWriter, r *http.Request) {
	var creds map[string]string
	json.NewDecoder(r.Body).Decode(&creds)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token":   "stub-jwt-token",
		"user":    creds["username"],
		"expires": time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339),
	})
}

func handleRegister(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = fmt.Sprintf("user-%d", time.Now().UnixMilli())
	body["created_at"] = time.Now().UTC().Format(time.RFC3339)
	delete(body, "password")
	writeJSON(w, http.StatusCreated, body)
}

// ---- Setup ----

var setupComplete = false

func handleSetupStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":         true,
		"needsSetup": !setupComplete,
	})
}

func handleSetup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{
			"ok":    false,
			"error": "Method not allowed",
		})
		return
	}

	if setupComplete {
		writeJSON(w, http.StatusConflict, map[string]interface{}{
			"ok":    false,
			"error": "Setup already completed",
		})
		return
	}

	var setupData struct {
		AppName            string `json:"appName"`
		AppURL             string `json:"appUrl"`
		GitHubClientID     string `json:"githubClientId"`
		GitHubClientSecret string `json:"githubClientSecret"`
		AdminEmail         string `json:"adminEmail"`
		AdminPassword      string `json:"adminPassword"`
		GitHubPat          string `json:"githubPat"`
		GitHubOwner        string `json:"githubOwner"`
		GitHubRepo         string `json:"githubRepo"`
		LlmProvider        string `json:"llmProvider"`
		LlmApiKey          string `json:"llmApiKey"`
		LlmModel           string `json:"llmModel"`
	}

	if err := json.NewDecoder(r.Body).Decode(&setupData); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"ok":    false,
			"error": "Invalid JSON",
		})
		return
	}

	// Validate required fields
	if setupData.AppName == "" || setupData.AppURL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"ok":    false,
			"error": "App name and URL are required",
		})
		return
	}

	if setupData.GitHubClientID == "" || setupData.GitHubClientSecret == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"ok":    false,
			"error": "GitHub OAuth credentials are required",
		})
		return
	}

	if setupData.AdminEmail == "" || setupData.AdminPassword == "" || len(setupData.AdminPassword) < 8 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"ok":    false,
			"error": "Valid admin email and password (8+ chars) are required",
		})
		return
	}

	// Update config
	cfg.AppName = setupData.AppName
	cfg.AppURL = setupData.AppURL
	cfg.GitHubClientID = setupData.GitHubClientID
	cfg.GitHubClientSecret = setupData.GitHubClientSecret
	cfg.GitHubRedirectURL = setupData.AppURL + "/api/auth/github/callback"
	// ... other config

	setupComplete = true

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":      true,
		"message": "Setup completed successfully",
	})
}

// ---- Settings ----

func handleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		// Return current settings (excluding secrets)
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"ok": true,
			"settings": map[string]interface{}{
				"appName":        cfg.AppName,
				"appUrl":         cfg.AppURL,
				"githubClientId": maskSecret(cfg.GitHubClientID),
				"setupComplete":  setupComplete,
			},
		})

	case http.MethodPut, http.MethodPatch:
		// Update settings
		var settings struct {
			AppName            string `json:"appName,omitempty"`
			AppURL             string `json:"appUrl,omitempty"`
			GitHubClientID     string `json:"githubClientId,omitempty"`
			GitHubClientSecret string `json:"githubClientSecret,omitempty"`
		}

		if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{
				"ok":    false,
				"error": "Invalid JSON",
			})
			return
		}

		// Update non-empty fields
		if settings.AppName != "" {
			cfg.AppName = settings.AppName
		}
		if settings.AppURL != "" {
			cfg.AppURL = settings.AppURL
			cfg.GitHubRedirectURL = settings.AppURL + "/api/auth/github/callback"
		}
		if settings.GitHubClientID != "" {
			cfg.GitHubClientID = settings.GitHubClientID
		}
		if settings.GitHubClientSecret != "" {
			cfg.GitHubClientSecret = settings.GitHubClientSecret
		}

		log.Printf("[Settings] Configuration updated")

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"ok":      true,
			"message": "Settings updated",
		})

	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{
			"ok":    false,
			"error": "Method not allowed",
		})
	}
}

func maskSecret(s string) string {
	if len(s) <= 8 {
		return "***"
	}
	return s[:4] + "..." + s[len(s)-4:]
}

// ---- GitHub OAuth ----

func handleGitHubAuth(w http.ResponseWriter, r *http.Request) {
	if cfg.GitHubClientID == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
			"ok":     false,
			"error":  "GitHub OAuth not configured",
			"reason": "not_configured",
			"fix":    "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET env vars",
		})
		return
	}

	// Generate state token to prevent CSRF
	stateBytes := make([]byte, 32)
	if _, err := rand.Read(stateBytes); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"ok":    false,
			"error": "Failed to generate state",
		})
		return
	}
	state := base64.URLEncoding.EncodeToString(stateBytes)

	// Build GitHub authorization URL
	authURL := fmt.Sprintf(
		"https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&scope=%s&state=%s",
		url.QueryEscape(cfg.GitHubClientID),
		url.QueryEscape(cfg.GitHubRedirectURL),
		url.QueryEscape("user:email read:user"),
		url.QueryEscape(state),
	)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":       true,
		"auth_url": authURL,
		"state":    state,
	})
}

func handleGitHubCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	errorParam := r.URL.Query().Get("error")

	if errorParam != "" {
		http.Redirect(w, r, cfg.AppURL+"/login?error="+url.QueryEscape(errorParam), http.StatusTemporaryRedirect)
		return
	}

	// State is optional (used when initiating from frontend) - we could verify it against session
	_ = state // State verification would require server-side session storage

	if code == "" {
		http.Redirect(w, r, cfg.AppURL+"/login?error=no_code", http.StatusTemporaryRedirect)
		return
	}

	// Exchange code for access token
	tokenResp, err := exchangeGitHubCode(code)
	if err != nil {
		log.Printf("[GitHub OAuth] Token exchange failed: %v", err)
		http.Redirect(w, r, cfg.AppURL+"/login?error=token_exchange_failed", http.StatusTemporaryRedirect)
		return
	}

	// Get GitHub user info
	user, err := getGitHubUser(tokenResp.AccessToken)
	if err != nil {
		log.Printf("[GitHub OAuth] Failed to get user: %v", err)
		http.Redirect(w, r, cfg.AppURL+"/login?error=user_fetch_failed", http.StatusTemporaryRedirect)
		return
	}

	// Generate JWT token
	userID := fmt.Sprintf("github_%d", user.ID)
	jwtToken, err := generateJWT(userID, user.Login, user.Email, "github")
	if err != nil {
		log.Printf("[GitHub OAuth] Failed to generate JWT: %v", err)
		http.Redirect(w, r, cfg.AppURL+"/login?error=token_generation_failed", http.StatusTemporaryRedirect)
		return
	}

	// Redirect to frontend with token
	redirectURL := fmt.Sprintf("%s/login?token=%s&provider=github&username=%s",
		cfg.AppURL,
		url.QueryEscape(jwtToken),
		url.QueryEscape(user.Login),
	)
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

func handleGetMe(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*Claims)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":   true,
		"user": user,
	})
}

func handleLogout(w http.ResponseWriter, r *http.Request) {
	// In a real implementation, you might invalidate the token in a database or Redis
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":      true,
		"message": "Logged out successfully",
	})
}

// ---- WebSocket stub ----

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusUpgradeRequired)
	w.Write([]byte("WebSocket endpoint - upgrade required"))
}

// ---- Agent Orchestrator Handlers ----

func handleAgentSwarm(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"agents": []interface{}{},
		"total":  0,
		"status": "healthy",
	})
}

func handleSpawnAgent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":        fmt.Sprintf("agent-%d", time.Now().UnixMilli()),
		"type":      body["type"],
		"status":    "spawned",
		"created_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func handleAgentHeartbeat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	agentID := r.URL.Query().Get("agent_id")
	if agentID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "agent_id required"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"agent_id": agentID,
		"status":   "alive",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func handleAgentHandoff(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"from_agent": body["from_agent"],
		"to_agent":   body["to_agent"],
		"task":       body["task"],
		"status":     "handoff_initiated",
	})
}

// ---- Bounty Hub Handlers ----

func handleBountyPrograms(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"programs": []interface{}{},
		"total":    0,
	})
}

func handleBountySync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":          "syncing",
		"last_sync_time":  time.Now().UTC().Format(time.RFC3339),
		"next_sync_time":  time.Now().Add(30 * time.Minute).UTC().Format(time.RFC3339),
		"total_programs":  0,
	})
}

func handleBountyHunt(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"program_id": body["program_id"],
		"status":     "added_to_hunt_queue",
		"created_at": time.Now().UTC().Format(time.RFC3339),
	})
}

// ---- MCP Tool Execution Handlers ----

func handleMCPExecute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"execution_id": fmt.Sprintf("exec-%d", time.Now().UnixMilli()),
		"tool":         body["tool"],
		"status":       "executing",
		"result":       nil,
	})
}

func handleMCPTools(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"tools": []interface{}{},
		"total": 0,
	})
}

// ---- Docker Agent Spawning Handlers ----

func handleDockerAgentSpawn(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"container_id": fmt.Sprintf("agent-%d", time.Now().UnixMilli()),
		"agent_type":   body["agent_type"],
		"status":       "running",
		"created_at":   time.Now().UTC().Format(time.RFC3339),
	})
}

func handleDockerAgents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"containers": []interface{}{},
		"total":      0,
	})
}

// ---- Router ----

func setupRoutes() http.Handler {
	mux := http.NewServeMux()

	// Health (both versioned and unversioned)
	mux.HandleFunc("/api/v1/health", handleHealth)
	mux.HandleFunc("/api/health", handleHealth)
	mux.HandleFunc("/metrics", handleMetrics)

	// Setup (public routes for initial configuration)
	log.Println("[DEBUG] Registering setup routes")
	mux.HandleFunc("/api/v1/setup/status", handleSetupStatus)
	mux.HandleFunc("/api/v1/setup", handleSetup)
	mux.HandleFunc("/api/setup/status", handleSetupStatus)
	mux.HandleFunc("/api/setup", handleSetup)

	// Settings (protected after setup)
	mux.HandleFunc("/api/v1/settings", authMiddleware(handleSettings))
	mux.HandleFunc("/api/settings", authMiddleware(handleSettings))

	// Auth
	mux.HandleFunc("/api/v1/auth/login", handleLogin)
	mux.HandleFunc("/api/v1/auth/register", handleRegister)
	mux.HandleFunc("/api/v1/auth/github", handleGitHubAuth)
	mux.HandleFunc("/api/v1/auth/github/callback", handleGitHubCallback)
	mux.HandleFunc("/api/v1/auth/me", authMiddleware(handleGetMe))
	mux.HandleFunc("/api/v1/auth/logout", authMiddleware(handleLogout))
	mux.HandleFunc("/api/auth/login", handleLogin)
	mux.HandleFunc("/api/auth/register", handleRegister)
	mux.HandleFunc("/api/auth/github", handleGitHubAuth)
	mux.HandleFunc("/api/auth/github/callback", handleGitHubCallback)
	mux.HandleFunc("/api/auth/me", authMiddleware(handleGetMe))
	mux.HandleFunc("/api/auth/logout", authMiddleware(handleLogout))

	// Services
	mux.HandleFunc("/api/services", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			handleServicesCheck(w, r)
		} else {
			handleServices(w, r)
		}
	})
	mux.HandleFunc("/api/services/check", handleServicesCheck)

	// Dashboard
	mux.HandleFunc("/api/dashboard/stats", handleDashboardStats)
	mux.HandleFunc("/api/dashboard/activity", handleDashboardActivity)
	mux.HandleFunc("/api/dashboard/health", handleDashboardHealth)

	// Docker
	mux.HandleFunc("/api/docker/containers", handleDockerContainers)
	mux.HandleFunc("/api/docker/images", handleDockerImages)
	mux.HandleFunc("/api/docker/", func(w http.ResponseWriter, r *http.Request) {
		// Route /api/docker/containers/{id}/start|stop|restart|logs|terminal
		path := strings.TrimPrefix(r.URL.Path, "/api/docker/containers/")
		parts := strings.SplitN(path, "/", 2)
		if len(parts) == 2 {
			id := parts[0]
			action := parts[1]
			if action == "logs" {
				handleContainerLogs(w, r, id)
			} else if action == "terminal" {
				writeJSON(w, http.StatusOK, map[string]interface{}{
					"ok":     false,
					"reason": "websocket_not_implemented",
					"fix":    fmt.Sprintf("Use: docker exec -it %s bash", id),
				})
			} else {
				handleContainerAction(w, r, id, action)
			}
			return
		}
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "endpoint not found"})
	})

	// MCP
	mux.HandleFunc("/api/mcp/servers", handleMCPServers)
	mux.HandleFunc("/api/v1/mcp/servers", handleMCPServers)
	mux.HandleFunc("/api/v1/mcp/execute", handleMCPExecute)
	mux.HandleFunc("/api/v1/mcp/tools", handleMCPTools)

	// Browsers
	mux.HandleFunc("/api/browsers/sessions", handleBrowserSessions)
	mux.HandleFunc("/api/browsers/", func(w http.ResponseWriter, r *http.Request) {
		handleBrowserSessions(w, r)
	})

	// Agents & Workflows (both versioned and unversioned)
	mux.HandleFunc("/api/v1/agents", handleAgents)
	mux.HandleFunc("/api/agents", handleAgents)
	mux.HandleFunc("/api/v1/agents/swarm", handleAgentSwarm)
	mux.HandleFunc("/api/v1/agents/spawn", handleSpawnAgent)
	mux.HandleFunc("/api/v1/agents/heartbeat", handleAgentHeartbeat)
	mux.HandleFunc("/api/v1/agents/handoff", handleAgentHandoff)
	mux.HandleFunc("/api/v1/workflows", handleWorkflows)
	mux.HandleFunc("/api/workflows", handleWorkflows)

	// Bug bounty
	mux.HandleFunc("/api/v1/targets", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			handleCreateTarget(w, r)
		} else {
			handleTargets(w, r)
		}
	})
	mux.HandleFunc("/api/v1/bounty/programs", handleBountyPrograms)
	mux.HandleFunc("/api/v1/bounty/sync", handleBountySync)
	mux.HandleFunc("/api/v1/bounty/hunt", handleBountyHunt)
	mux.HandleFunc("/api/v1/scans", handleScans)
	mux.HandleFunc("/api/v1/vulnerabilities", handleVulnerabilities)

	// MCP Tool Execution
	mux.HandleFunc("/api/v1/mcp/execute", handleMCPExecute)
	mux.HandleFunc("/api/v1/mcp/tools", handleMCPTools)

	// Docker Agent Spawning
	mux.HandleFunc("/api/v1/docker/agents/spawn", handleDockerAgentSpawn)
	mux.HandleFunc("/api/v1/docker/agents", handleDockerAgents)

	// WebSocket
	mux.HandleFunc("/ws", handleWebSocket)

	// Catch-all
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			writeJSON(w, http.StatusNotFound, map[string]string{
				"error": "endpoint not found",
				"path":  r.URL.Path,
			})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"service": cfg.AppName + " API",
			"version": getEnv("VERSION", "1.0.0"),
			"docs":    "/api/health",
		})
	})

	return corsMiddleware(mux)
}

func main() {
	cfg = loadConfig()

	addr := ":" + cfg.Port
	metricsAddr := ":" + getEnv("METRICS_PORT", "9090")

	log.Printf("[Harbinger] Starting %s API server (env: %s)", cfg.AppName, cfg.AppEnv)
	log.Printf("[Harbinger] API listening on %s", addr)
	log.Printf("[Harbinger] Metrics listening on %s", metricsAddr)
	log.Printf("[Harbinger] DB: %s@%s:%s/%s", cfg.DBUser, cfg.DBHost, cfg.DBPort, cfg.DBName)
	log.Printf("[Harbinger] Redis: %s:%s", cfg.RedisHost, cfg.RedisPort)
	log.Printf("[Harbinger] Neo4j: %s:%s", cfg.Neo4jHost, cfg.Neo4jPort)
	log.Printf("[Harbinger] MCP Enabled: %v", cfg.MCPEnabled)
	log.Printf("[Harbinger] Docker Socket: %s (available: %v)", cfg.DockerSocket, dockerAvailable())
	log.Printf("[Harbinger] HexStrike: %q | PentAGI: %q | RedTeam: %q",
		cfg.HexStrikeURL, cfg.PentagiURL, cfg.RedteamURL)

	// Start metrics server in background
	go func() {
		metricsMux := http.NewServeMux()
		metricsMux.HandleFunc("/metrics", handleMetrics)
		metricsMux.HandleFunc("/health", handleHealth)
		if err := http.ListenAndServe(metricsAddr, metricsMux); err != nil {
			log.Printf("[Harbinger] Metrics server error: %v", err)
		}
	}()

	// Start main API server
	srv := &http.Server{
		Addr:         addr,
		Handler:      setupRoutes(),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("[Harbinger] Server failed: %v", err)
	}
}
