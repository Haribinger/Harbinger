package main

import (
	"fmt"
	"testing"
	"time"
)

func TestRateLimiter_Basic(t *testing.T) {
	rl := newRateLimiter(3, time.Minute)
	ip := "192.0.2.1"

	// First 3 requests should be allowed.
	for i := 1; i <= 3; i++ {
		if !rl.allow(ip) {
			t.Errorf("request %d: expected allow=true, got false", i)
		}
	}

	// 4th request should be denied.
	if rl.allow(ip) {
		t.Error("4th request: expected allow=false, got true")
	}
}

func TestRateLimiter_DifferentIPs(t *testing.T) {
	rl := newRateLimiter(2, time.Minute)
	ip1 := "10.0.0.1"
	ip2 := "10.0.0.2"

	// Exhaust ip1's allowance.
	rl.allow(ip1)
	rl.allow(ip1)

	// ip1 should now be denied.
	if rl.allow(ip1) {
		t.Error("ip1: expected allow=false after exhaustion, got true")
	}

	// ip2 should still be allowed independently.
	if !rl.allow(ip2) {
		t.Error("ip2: expected allow=true (independent limit), got false")
	}
}

func TestRateLimiter_WindowReset(t *testing.T) {
	window := 50 * time.Millisecond
	rl := newRateLimiter(2, window)
	ip := "10.0.1.1"

	// Exhaust the window.
	rl.allow(ip)
	rl.allow(ip)

	if rl.allow(ip) {
		t.Error("expected allow=false after exhaustion, got true")
	}

	// Wait for the window to expire.
	time.Sleep(60 * time.Millisecond)

	// After the window resets, requests should be allowed again.
	if !rl.allow(ip) {
		t.Error("expected allow=true after window reset, got false")
	}
}

func TestRateLimiter_Lockout(t *testing.T) {
	rl := newRateLimiter(100, time.Minute)
	ip := "10.0.2.1"

	// Record exactly lockoutThreshold failures to trigger lockout.
	for i := 0; i < lockoutThreshold; i++ {
		rl.recordAuthFailure(ip)
	}

	// After lockout, allow() must return false.
	if rl.allow(ip) {
		t.Error("expected allow=false after lockout, got true")
	}
}

func TestRateLimiter_ResetFailures(t *testing.T) {
	rl := newRateLimiter(100, time.Minute)
	ip := "10.0.3.1"

	// Record failures just below the threshold.
	for i := 0; i < lockoutThreshold-1; i++ {
		rl.recordAuthFailure(ip)
	}

	// Reset the failure counter (simulating a successful login).
	rl.resetAuthFailures(ip)

	// Record one more failure — should NOT trigger lockout since counter was reset.
	rl.recordAuthFailure(ip)

	if !rl.allow(ip) {
		t.Error("expected allow=true after failure reset, got false — lockout should not have triggered")
	}
}

func TestRateLimiter_MaxEntries(t *testing.T) {
	rl := newRateLimiter(10, time.Minute)
	// Override maxEntries to a small value so the eviction logic kicks in.
	rl.maxEntries = 3

	// Add the first 3 IPs (fills the map to capacity).
	oldestIP := "10.1.0.1"
	rl.allow(oldestIP)
	time.Sleep(1 * time.Millisecond) // ensure distinct timestamps

	for i := 2; i <= 3; i++ {
		rl.allow(fmt.Sprintf("10.1.0.%d", i))
	}

	// Adding a 4th IP should evict the oldest entry.
	fourthIP := "10.1.0.4"
	rl.allow(fourthIP)

	rl.mu.Lock()
	_, oldestPresent := rl.visitors[oldestIP]
	_, fourthPresent := rl.visitors[fourthIP]
	total := len(rl.visitors)
	rl.mu.Unlock()

	if oldestPresent {
		t.Errorf("oldest IP %q should have been evicted, but it is still in the map", oldestIP)
	}
	if !fourthPresent {
		t.Errorf("fourth IP %q should be in the map after eviction, but it is missing", fourthIP)
	}
	if total > rl.maxEntries {
		t.Errorf("visitor map size %d exceeds maxEntries %d", total, rl.maxEntries)
	}
}
