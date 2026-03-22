package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ============================================================================
// MULTI-PROVIDER OAUTH — Google, OpenAI, Anthropic + API key validation
// ============================================================================

// ---- Google OAuth ----

func handleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	clientID := getEnv("GOOGLE_CLIENT_ID", "")
	if clientID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"ok":    false,
			"error": "not_configured",
			"fix":   "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables",
		})
		return
	}

	state := generateRandomString(32)
	storeOAuthState(state)

	redirectURL := getEnv("GOOGLE_REDIRECT_URL", cfg.AppURL+"/api/auth/google/callback")

	params := url.Values{}
	params.Set("client_id", clientID)
	params.Set("redirect_uri", redirectURL)
	params.Set("response_type", "code")
	params.Set("scope", "openid email profile")
	params.Set("state", state)
	params.Set("access_type", "offline")
	params.Set("prompt", "consent")

	authURL := "https://accounts.google.com/o/oauth2/v2/auth?" + params.Encode()

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"auth_url": authURL,
		"state":    state,
		"provider": "google",
	})
}

func handleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	if errParam := r.URL.Query().Get("error"); errParam != "" {
		redirectURL := fmt.Sprintf("%s/login?error=%s&provider=google", cfg.AppURL, url.QueryEscape(errParam))
		http.Redirect(w, r, redirectURL, http.StatusFound)
		return
	}

	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	if code == "" || state == "" || !validateAndConsumeOAuthState(state) {
		http.Redirect(w, r, cfg.AppURL+"/login?error=invalid_state&provider=google", http.StatusFound)
		return
	}

	// Exchange code for tokens
	tokenResp, err := exchangeGoogleCode(code)
	if err != nil {
		log.Printf("[OAuth] Google token exchange failed (see server logs for details)")
		http.Redirect(w, r, cfg.AppURL+"/login?error=token_exchange_failed&provider=google", http.StatusFound)
		return
	}

	// Fetch user profile
	user, err := getGoogleUser(tokenResp.AccessToken)
	if err != nil {
		log.Printf("[OAuth] Google user fetch failed: %v", err)
		http.Redirect(w, r, cfg.AppURL+"/login?error=user_fetch_failed&provider=google", http.StatusFound)
		return
	}

	// Generate Harbinger JWT
	token, err := generateJWT(user.ID, user.Name, user.Email, "google")
	if err != nil {
		log.Printf("[OAuth] JWT generation failed: %v", err)
		http.Redirect(w, r, cfg.AppURL+"/login?error=token_generation_failed", http.StatusFound)
		return
	}

	authCode := storeAuthCode(token)
	redirectURL := fmt.Sprintf("%s/login?code=%s&provider=google", cfg.AppURL, url.QueryEscape(authCode))
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

type GoogleTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	IDToken      string `json:"id_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
	Scope        string `json:"scope"`
}

type GoogleUser struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

func exchangeGoogleCode(code string) (*GoogleTokenResponse, error) {
	clientID := getEnv("GOOGLE_CLIENT_ID", "")
	clientSecret := getEnv("GOOGLE_CLIENT_SECRET", "")
	redirectURL := getEnv("GOOGLE_REDIRECT_URL", cfg.AppURL+"/api/auth/google/callback")

	data := url.Values{}
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("code", code)
	data.Set("redirect_uri", redirectURL)
	data.Set("grant_type", "authorization_code")

	req, err := http.NewRequest("POST", "https://oauth2.googleapis.com/token", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Google token exchange failed (%d): %s", resp.StatusCode, string(body))
	}

	var tokenResp GoogleTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, err
	}
	return &tokenResp, nil
}

func getGoogleUser(accessToken string) (*GoogleUser, error) {
	req, err := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Google API error (%d): %s", resp.StatusCode, string(body))
	}

	var user GoogleUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}
	return &user, nil
}

// ---- Provider API Key Validation ----
// Validates an API key against the provider's API without OAuth.
// Used for OpenAI, Anthropic, Mistral, Groq, etc. (no OAuth available).

func handleValidateProviderKey(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Provider string `json:"provider"`
		APIKey   string `json:"api_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Provider == "" || body.APIKey == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "provider and api_key required"})
		return
	}

	valid, info, err := validateProviderKey(body.Provider, body.APIKey, "")
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":       false,
			"valid":    false,
			"provider": body.Provider,
			"error":    err.Error(),
		})
		return
	}

	result := map[string]any{
		"ok":       true,
		"valid":    valid,
		"provider": body.Provider,
	}
	for k, v := range info {
		result[k] = v
	}

	// If valid, optionally issue a Harbinger JWT for the provider
	if valid {
		username := info["username"]
		if username == "" {
			username = body.Provider + "-user"
		}
		email := info["email"]
		if email == "" {
			email = username + "@" + body.Provider + ".local"
		}

		token, err := generateJWT(body.Provider+"-"+username, username, email, body.Provider)
		if err == nil {
			result["jwt"] = token
		}
	}

	writeJSON(w, http.StatusOK, result)
}

// validateProviderKey tests an API key (or for ollama/lmstudio/gpt4all, baseURL) against the provider.
// baseURL is optional; when non-empty it overrides env for ollama/lmstudio/gpt4all (used by "Test connection").
// Returns (valid, info map, error).
func validateProviderKey(provider, apiKey, baseURL string) (bool, map[string]string, error) {
	client := &http.Client{Timeout: 10 * time.Second}

	switch provider {
	case "openai":
		req, err := http.NewRequest("GET", "https://api.openai.com/v1/models", nil)
		if err != nil {
			return false, nil, fmt.Errorf("create request: %v", err)
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		resp, err := client.Do(req)
		if err != nil {
			return false, nil, fmt.Errorf("network error: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			return true, map[string]string{"username": "openai-user", "models": "available"}, nil
		}
		body, _ := io.ReadAll(resp.Body)
		return false, nil, fmt.Errorf("OpenAI API returned %d: %s", resp.StatusCode, string(body))

	case "anthropic":
		// Anthropic uses x-api-key header
		req, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", strings.NewReader(`{"model":"claude-haiku-4-5-20251001","max_tokens":1,"messages":[{"role":"user","content":"ping"}]}`))
		if err != nil {
			return false, nil, fmt.Errorf("create request: %v", err)
		}
		req.Header.Set("x-api-key", apiKey)
		req.Header.Set("anthropic-version", "2023-06-01")
		req.Header.Set("Content-Type", "application/json")
		resp, err := client.Do(req)
		if err != nil {
			return false, nil, fmt.Errorf("network error: %v", err)
		}
		defer resp.Body.Close()
		// 200 or 400 (invalid request but key valid) both indicate a valid key
		if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusBadRequest {
			return true, map[string]string{"username": "anthropic-user"}, nil
		}
		if resp.StatusCode == http.StatusUnauthorized {
			return false, nil, fmt.Errorf("invalid API key")
		}
		return false, nil, fmt.Errorf("Anthropic API returned %d", resp.StatusCode)

	case "groq":
		req, err := http.NewRequest("GET", "https://api.groq.com/openai/v1/models", nil)
		if err != nil {
			return false, nil, fmt.Errorf("create request: %v", err)
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		resp, err := client.Do(req)
		if err != nil {
			return false, nil, fmt.Errorf("network error: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			return true, map[string]string{"username": "groq-user"}, nil
		}
		return false, nil, fmt.Errorf("Groq API returned %d", resp.StatusCode)

	case "mistral":
		req, err := http.NewRequest("GET", "https://api.mistral.ai/v1/models", nil)
		if err != nil {
			return false, nil, fmt.Errorf("create request: %v", err)
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		resp, err := client.Do(req)
		if err != nil {
			return false, nil, fmt.Errorf("network error: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			return true, map[string]string{"username": "mistral-user"}, nil
		}
		return false, nil, fmt.Errorf("Mistral API returned %d", resp.StatusCode)

	case "gemini", "google":
		testURL := "https://generativelanguage.googleapis.com/v1beta/models"
		req, err := http.NewRequest("GET", testURL, nil)
		if err != nil {
			return false, nil, fmt.Errorf("create request: %v", err)
		}
		req.Header.Set("x-goog-api-key", apiKey)
		resp, err := client.Do(req)
		if err != nil {
			return false, nil, fmt.Errorf("network error: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			return true, map[string]string{"username": "google-user"}, nil
		}
		return false, nil, fmt.Errorf("Google AI API returned %d", resp.StatusCode)

	case "ollama":
		ollamaBase := baseURL
		if ollamaBase == "" {
			ollamaBase = getEnv("OLLAMA_URL", "http://localhost:11434")
		}
		req, err := http.NewRequest("GET", ollamaBase+"/api/tags", nil)
		if err != nil {
			return false, nil, fmt.Errorf("create request: %v", err)
		}
		resp, err := client.Do(req)
		if err != nil {
			return false, nil, fmt.Errorf("Ollama not reachable: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			var result struct {
				Models []struct{ Name string `json:"name"` } `json:"models"`
			}
			json.NewDecoder(resp.Body).Decode(&result)
			models := make([]string, len(result.Models))
			for i, m := range result.Models {
				models[i] = m.Name
			}
			return true, map[string]string{
				"username": "local",
				"models":   strings.Join(models, ","),
			}, nil
		}
		return false, nil, fmt.Errorf("Ollama returned %d", resp.StatusCode)

	case "lmstudio":
		lmBase := baseURL
		if lmBase == "" {
			lmBase = getEnv("LMSTUDIO_URL", "http://localhost:1234/v1")
		}
		req, err := http.NewRequest("GET", lmBase+"/models", nil)
		if err != nil {
			return false, nil, fmt.Errorf("create request: %v", err)
		}
		resp, err := client.Do(req)
		if err != nil {
			return false, nil, fmt.Errorf("LM Studio not reachable: %v", err)
		}
		defer resp.Body.Close()
		return resp.StatusCode == http.StatusOK, map[string]string{"username": "local"}, nil

	default:
		return false, nil, fmt.Errorf("unsupported provider: %s", provider)
	}
}

// ---- Provider Connection Test ----
// Quick ping to check if a provider is reachable + what models are available.

func handleTestProviderConnection(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Provider string `json:"provider"`
		APIKey   string `json:"api_key"`
		BaseURL  string `json:"base_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Provider == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "provider required"})
		return
	}

	start := time.Now()
	valid, info, err := validateProviderKey(body.Provider, body.APIKey, body.BaseURL)
	latency := time.Since(start).Milliseconds()

	result := map[string]any{
		"ok":         true,
		"provider":   body.Provider,
		"reachable":  err == nil || valid,
		"valid_key":  valid,
		"latency_ms": latency,
	}

	if err != nil {
		result["error"] = err.Error()
	}
	if info != nil {
		for k, v := range info {
			result[k] = v
		}
	}

	writeJSON(w, http.StatusOK, result)
}

// ---- List Available OAuth Providers ----

func handleListAuthProviders(w http.ResponseWriter, r *http.Request) {
	providers := []map[string]any{
		{
			"id":          "github",
			"name":        "GitHub",
			"type":        "oauth",
			"configured":  cfg.GitHubClientID != "",
			"callback_url": cfg.AppURL + "/api/auth/github/callback",
			"flows":       []string{"oauth", "device", "token"},
		},
		{
			"id":          "google",
			"name":        "Google",
			"type":        "oauth",
			"configured":  getEnv("GOOGLE_CLIENT_ID", "") != "",
			"callback_url": cfg.AppURL + "/api/auth/google/callback",
			"flows":       []string{"oauth"},
		},
		{
			"id":         "openai",
			"name":       "OpenAI",
			"type":       "api_key",
			"configured": false,
			"flows":      []string{"api_key"},
			"hint":       "OpenAI uses API keys — no OAuth flow. Validate at platform.openai.com",
		},
		{
			"id":         "anthropic",
			"name":       "Anthropic",
			"type":       "api_key",
			"configured": false,
			"flows":      []string{"api_key"},
			"hint":       "Anthropic uses API keys — no OAuth flow. Get yours at console.anthropic.com",
		},
		{
			"id":         "groq",
			"name":       "Groq",
			"type":       "api_key",
			"configured": false,
			"flows":      []string{"api_key"},
		},
		{
			"id":         "mistral",
			"name":       "Mistral AI",
			"type":       "api_key",
			"configured": false,
			"flows":      []string{"api_key"},
		},
		{
			"id":         "gemini",
			"name":       "Google Gemini",
			"type":       "api_key",
			"configured": false,
			"flows":      []string{"api_key"},
		},
		{
			"id":         "ollama",
			"name":       "Ollama (Local)",
			"type":       "local",
			"configured": true,
			"flows":      []string{"local"},
		},
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"providers": providers,
	})
}
