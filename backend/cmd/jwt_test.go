package main

import (
	"strings"
	"testing"
	"time"
)

const testJWTSecret = "test-secret-key-for-jwt"

func TestGenerateAndValidateJWT(t *testing.T) {
	cfg.JWTSecret = testJWTSecret

	token, err := generateJWT("user-123", "alice", "alice@example.com", "github")
	if err != nil {
		t.Fatalf("generateJWT returned error: %v", err)
	}
	if token == "" {
		t.Fatal("generateJWT returned empty token")
	}

	claims, err := validateJWT(token)
	if err != nil {
		t.Fatalf("validateJWT returned error: %v", err)
	}

	if claims.UserID != "user-123" {
		t.Errorf("UserID: expected %q, got %q", "user-123", claims.UserID)
	}
	if claims.Username != "alice" {
		t.Errorf("Username: expected %q, got %q", "alice", claims.Username)
	}
	if claims.Email != "alice@example.com" {
		t.Errorf("Email: expected %q, got %q", "alice@example.com", claims.Email)
	}
	if claims.Provider != "github" {
		t.Errorf("Provider: expected %q, got %q", "github", claims.Provider)
	}
	if claims.Aud != "harbinger" {
		t.Errorf("Aud: expected %q, got %q", "harbinger", claims.Aud)
	}
	if claims.Jti == "" {
		t.Error("Jti should not be empty")
	}
	now := time.Now().Unix()
	if claims.Iat <= 0 {
		t.Error("Iat should be positive")
	}
	if claims.Exp <= now {
		t.Errorf("Exp should be in the future: exp=%d now=%d", claims.Exp, now)
	}
}

func TestValidateJWT_ExpiredToken(t *testing.T) {
	cfg.JWTSecret = testJWTSecret

	// Build a token with exp already in the past.
	claims := Claims{
		UserID:   "user-expired",
		Username: "bob",
		Email:    "bob@example.com",
		Provider: "github",
		Exp:      time.Now().Add(-1 * time.Hour).Unix(),
		Iat:      time.Now().Add(-2 * time.Hour).Unix(),
		Jti:      "test-jti-expired",
		Aud:      "harbinger",
	}
	token := buildTestToken(claims)

	_, err := validateJWT(token)
	if err == nil {
		t.Fatal("expected error for expired token, got nil")
	}
	if !strings.Contains(err.Error(), "token expired") {
		t.Errorf("expected 'token expired' error, got: %v", err)
	}
}

func TestValidateJWT_InvalidSignature(t *testing.T) {
	cfg.JWTSecret = testJWTSecret

	token, err := generateJWT("user-456", "carol", "carol@example.com", "local")
	if err != nil {
		t.Fatalf("generateJWT: %v", err)
	}

	// Tamper with the signature (last segment).
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Fatalf("expected 3 JWT parts, got %d", len(parts))
	}
	parts[2] = parts[2] + "tampered"
	tampered := strings.Join(parts, ".")

	_, err = validateJWT(tampered)
	if err == nil {
		t.Fatal("expected error for tampered signature, got nil")
	}
	if !strings.Contains(err.Error(), "invalid signature") {
		t.Errorf("expected 'invalid signature' error, got: %v", err)
	}
}

func TestValidateJWT_MalformedToken(t *testing.T) {
	cfg.JWTSecret = testJWTSecret

	cases := []struct {
		name  string
		token string
	}{
		{"not a jwt", "not.a.jwt"},
		{"single segment", "abc"},
		{"empty string", ""},
		{"two segments", "header.payload"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := validateJWT(tc.token)
			if err == nil {
				t.Errorf("expected error for malformed token %q, got nil", tc.token)
			}
		})
	}
}

func TestValidateJWT_InvalidAudience(t *testing.T) {
	cfg.JWTSecret = testJWTSecret

	claims := Claims{
		UserID:   "user-789",
		Username: "dave",
		Email:    "dave@example.com",
		Provider: "local",
		Exp:      time.Now().Add(time.Hour).Unix(),
		Iat:      time.Now().Unix(),
		Jti:      "test-jti-aud",
		Aud:      "wrong-service",
	}
	token := buildTestToken(claims)

	_, err := validateJWT(token)
	if err == nil {
		t.Fatal("expected error for invalid audience, got nil")
	}
	if !strings.Contains(err.Error(), "invalid audience") {
		t.Errorf("expected 'invalid audience' error, got: %v", err)
	}
}

func TestGenerateJWT_UniqueJTI(t *testing.T) {
	cfg.JWTSecret = testJWTSecret

	token1, err := generateJWT("user-1", "user1", "u1@example.com", "local")
	if err != nil {
		t.Fatalf("generateJWT token1: %v", err)
	}
	token2, err := generateJWT("user-2", "user2", "u2@example.com", "local")
	if err != nil {
		t.Fatalf("generateJWT token2: %v", err)
	}

	claims1, err := validateJWT(token1)
	if err != nil {
		t.Fatalf("validateJWT token1: %v", err)
	}
	claims2, err := validateJWT(token2)
	if err != nil {
		t.Fatalf("validateJWT token2: %v", err)
	}

	if claims1.Jti == claims2.Jti {
		t.Errorf("expected unique JTIs, but both are %q", claims1.Jti)
	}
}
