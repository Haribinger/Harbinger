package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// buildTestToken constructs a signed JWT from the provided Claims using cfg.JWTSecret.
// It is used by both jwt_test.go and auth_middleware_test.go.
func buildTestToken(claims Claims) string {
	header := map[string]string{"alg": "HS256", "typ": "JWT"}
	headerJSON, _ := json.Marshal(header)
	claimsJSON, _ := json.Marshal(claims)
	headerB64 := base64URLEncode(headerJSON)
	claimsB64 := base64URLEncode(claimsJSON)
	signatureInput := headerB64 + "." + claimsB64
	h := hmac.New(sha256.New, []byte(cfg.JWTSecret))
	h.Write([]byte(signatureInput))
	signature := base64URLEncode(h.Sum(nil))
	return headerB64 + "." + claimsB64 + "." + signature
}

// generateTestJWTWithRole constructs a valid JWT that includes the Role field,
// which generateJWT does not expose as a parameter.
func generateTestJWTWithRole(userID, username, role string) string {
	claims := Claims{
		UserID:   userID,
		Username: username,
		Role:     role,
		Exp:      time.Now().Add(time.Hour).Unix(),
		Iat:      time.Now().Unix(),
		Jti:      "test-jti-role",
		Aud:      "harbinger",
	}
	return buildTestToken(claims)
}

// okHandler is a minimal handler that writes {"ok":true} for successful middleware pass-through.
func okHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func TestAuthMiddleware_NoHeader(t *testing.T) {
	cfg.JWTSecret = testJWTSecret

	handler := authMiddleware(okHandler)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	handler(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddleware_InvalidFormat(t *testing.T) {
	cfg.JWTSecret = testJWTSecret

	handler := authMiddleware(okHandler)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	// Provide a non-Bearer scheme.
	req.Header.Set("Authorization", "NotBearer xyz")
	w := httptest.NewRecorder()
	handler(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddleware_ValidToken(t *testing.T) {
	cfg.JWTSecret = testJWTSecret

	token, err := generateJWT("user-mid-1", "eve", "eve@example.com", "local")
	if err != nil {
		t.Fatalf("generateJWT: %v", err)
	}

	// The inner handler verifies that claims were placed in the context.
	var capturedUserID, capturedUsername string
	inner := func(w http.ResponseWriter, r *http.Request) {
		capturedUserID, _ = r.Context().Value("userID").(string)
		capturedUsername, _ = r.Context().Value("username").(string)
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	}

	handler := authMiddleware(inner)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	handler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d — body: %s", w.Code, w.Body.String())
	}
	if capturedUserID != "user-mid-1" {
		t.Errorf("userID in context: expected %q, got %q", "user-mid-1", capturedUserID)
	}
	if capturedUsername != "eve" {
		t.Errorf("username in context: expected %q, got %q", "eve", capturedUsername)
	}
}

func TestAuthMiddleware_ExpiredToken(t *testing.T) {
	cfg.JWTSecret = testJWTSecret

	// Build a token that is already expired.
	expired := Claims{
		UserID:   "user-exp",
		Username: "frank",
		Email:    "frank@example.com",
		Provider: "local",
		Exp:      time.Now().Add(-1 * time.Hour).Unix(),
		Iat:      time.Now().Add(-2 * time.Hour).Unix(),
		Jti:      "jti-exp-mid",
		Aud:      "harbinger",
	}
	token := buildTestToken(expired)

	handler := authMiddleware(okHandler)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	handler(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for expired token, got %d", w.Code)
	}
}

func TestRequireAdmin_AdminRole(t *testing.T) {
	cfg.JWTSecret = testJWTSecret

	token := generateTestJWTWithRole("admin-user-1", "grace", "admin")

	var capturedRole string
	inner := func(w http.ResponseWriter, r *http.Request) {
		capturedRole, _ = r.Context().Value("role").(string)
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	}

	handler := requireAdmin(inner)
	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	handler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for admin role, got %d — body: %s", w.Code, w.Body.String())
	}
	if capturedRole != "admin" {
		t.Errorf("role in context: expected %q, got %q", "admin", capturedRole)
	}
}

func TestRequireAdmin_NonAdminRole(t *testing.T) {
	cfg.JWTSecret = testJWTSecret

	token := generateTestJWTWithRole("op-user-1", "henry", "operator")

	handler := requireAdmin(okHandler)
	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	handler(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for non-admin role, got %d — body: %s", w.Code, w.Body.String())
	}
}
