package memorylayer

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
)

// newTestWM spins up a miniredis instance and returns a WorkingMemory wired to
// it, plus a cleanup function.  Tests must defer the cleanup.
func newTestWM(t *testing.T) (*WorkingMemory, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)

	wm, err := NewWorkingMemory(WorkingMemoryConfig{
		Host: mr.Host(),
		Port: mr.Port(),
		TTL:  30 * time.Second,
	})
	if err != nil {
		t.Fatalf("NewWorkingMemory: %v", err)
	}
	t.Cleanup(func() { _ = wm.Close() })

	return wm, mr
}

// TestSetGet verifies that a value written with Set is returned intact by Get.
func TestSetGet(t *testing.T) {
	wm, _ := newTestWM(t)
	ctx := context.Background()

	const (
		mission = "m-001"
		key     = "target_host"
		want    = "10.0.0.1"
	)

	if err := wm.Set(ctx, mission, key, want); err != nil {
		t.Fatalf("Set: %v", err)
	}

	got, err := wm.Get(ctx, mission, key)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got != want {
		t.Errorf("Get = %q, want %q", got, want)
	}
}

// TestGetMissing verifies that Get on a key that was never written returns
// ("", nil) — not an error and not a redis.Nil propagation.
func TestGetMissing(t *testing.T) {
	wm, _ := newTestWM(t)
	ctx := context.Background()

	val, err := wm.Get(ctx, "m-nonexistent", "ghost")
	if err != nil {
		t.Fatalf("Get on missing key returned error: %v", err)
	}
	if val != "" {
		t.Errorf("Get on missing key = %q, want empty string", val)
	}
}

// TestGetAll verifies that GetAll returns all plain keys belonging to a mission
// and does NOT include list keys.
func TestGetAll(t *testing.T) {
	wm, _ := newTestWM(t)
	ctx := context.Background()
	const mission = "m-002"

	pairs := map[string]string{
		"scope":  "example.com",
		"status": "running",
		"phase":  "recon",
	}
	for k, v := range pairs {
		if err := wm.Set(ctx, mission, k, v); err != nil {
			t.Fatalf("Set(%q): %v", k, err)
		}
	}

	// Add a list entry — GetAll must not include it.
	if err := wm.Append(ctx, mission, "findings", "open port 80"); err != nil {
		t.Fatalf("Append: %v", err)
	}

	got, err := wm.GetAll(ctx, mission)
	if err != nil {
		t.Fatalf("GetAll: %v", err)
	}

	if len(got) != len(pairs) {
		t.Errorf("GetAll returned %d keys, want %d: %v", len(got), len(pairs), got)
	}
	for k, want := range pairs {
		if got[k] != want {
			t.Errorf("GetAll[%q] = %q, want %q", k, got[k], want)
		}
	}

	// Confirm no list key leaked into the result.
	for k := range got {
		if k == "list:findings" || k == "findings" {
			// "findings" as a plain key would be fine, but the list key
			// "list:findings" must not appear.
			if k == "list:findings" {
				t.Errorf("GetAll leaked list key %q", k)
			}
		}
	}
}

// TestAppendGetList verifies that multiple Append calls are reflected in order
// by GetList.
func TestAppendGetList(t *testing.T) {
	wm, _ := newTestWM(t)
	ctx := context.Background()
	const mission = "m-003"

	entries := []string{
		"CVE-2024-1234: RCE in example.com/login",
		"CVE-2024-5678: SQLi in /search endpoint",
		"Open redirect at /redirect?url=",
	}

	for _, e := range entries {
		if err := wm.Append(ctx, mission, "findings", e); err != nil {
			t.Fatalf("Append: %v", err)
		}
	}

	got, err := wm.GetList(ctx, mission, "findings")
	if err != nil {
		t.Fatalf("GetList: %v", err)
	}

	if len(got) != len(entries) {
		t.Fatalf("GetList returned %d items, want %d", len(got), len(entries))
	}
	for i, want := range entries {
		if got[i] != want {
			t.Errorf("GetList[%d] = %q, want %q", i, got[i], want)
		}
	}
}

// TestClear verifies that Clear removes every key (plain and list) for the
// given mission and returns nil when no keys remain.
func TestClear(t *testing.T) {
	wm, _ := newTestWM(t)
	ctx := context.Background()
	const mission = "m-004"

	// Write a mix of plain and list keys.
	_ = wm.Set(ctx, mission, "foo", "bar")
	_ = wm.Set(ctx, mission, "baz", "qux")
	_ = wm.Append(ctx, mission, "events", "started")

	if err := wm.Clear(ctx, mission); err != nil {
		t.Fatalf("Clear: %v", err)
	}

	// Plain keys must be gone.
	for _, k := range []string{"foo", "baz"} {
		val, err := wm.Get(ctx, mission, k)
		if err != nil {
			t.Errorf("Get(%q) after Clear: %v", k, err)
		}
		if val != "" {
			t.Errorf("Get(%q) after Clear = %q, want empty", k, val)
		}
	}

	// List must be gone.
	items, err := wm.GetList(ctx, mission, "events")
	if err != nil {
		t.Fatalf("GetList after Clear: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("GetList after Clear = %v, want empty", items)
	}

	// Clearing a mission with no keys must not error.
	if err := wm.Clear(ctx, "m-empty"); err != nil {
		t.Errorf("Clear on empty mission: %v", err)
	}
}

// TestTTL verifies that keys expire after the configured TTL.
// miniredis.FastForward advances fake time so the test runs in microseconds.
func TestTTL(t *testing.T) {
	mr := miniredis.RunT(t)

	wm, err := NewWorkingMemory(WorkingMemoryConfig{
		Host: mr.Host(),
		Port: mr.Port(),
		TTL:  5 * time.Second,
	})
	if err != nil {
		t.Fatalf("NewWorkingMemory: %v", err)
	}
	defer func() { _ = wm.Close() }()

	ctx := context.Background()
	const mission = "m-ttl"

	if err := wm.Set(ctx, mission, "ephemeral", "data"); err != nil {
		t.Fatalf("Set: %v", err)
	}

	// Confirm key is present before expiry.
	val, err := wm.Get(ctx, mission, "ephemeral")
	if err != nil {
		t.Fatalf("Get before expiry: %v", err)
	}
	if val != "data" {
		t.Fatalf("Get before expiry = %q, want %q", val, "data")
	}

	// Advance miniredis clock past the TTL.
	mr.FastForward(6 * time.Second)

	// Key must now be absent.
	val, err = wm.Get(ctx, mission, "ephemeral")
	if err != nil {
		t.Fatalf("Get after expiry: %v", err)
	}
	if val != "" {
		t.Errorf("Get after expiry = %q, want empty (key should have expired)", val)
	}
}

// TestStats verifies that Stats reports connectivity and a correct mission count.
func TestStats(t *testing.T) {
	wm, _ := newTestWM(t)
	ctx := context.Background()

	// No missions yet — active_missions should be 0.
	stats, err := wm.Stats(ctx)
	if err != nil {
		t.Fatalf("Stats (empty): %v", err)
	}
	if connected, _ := stats["connected"].(bool); !connected {
		t.Errorf("Stats.connected = false, want true")
	}
	if n, _ := stats["active_missions"].(int); n != 0 {
		t.Errorf("Stats.active_missions = %d, want 0", n)
	}

	// Write keys for two distinct missions.
	_ = wm.Set(ctx, "mission-alpha", "key1", "val1")
	_ = wm.Set(ctx, "mission-beta", "key1", "val1")
	_ = wm.Append(ctx, "mission-beta", "list1", "item")

	stats, err = wm.Stats(ctx)
	if err != nil {
		t.Fatalf("Stats (two missions): %v", err)
	}
	if connected, _ := stats["connected"].(bool); !connected {
		t.Errorf("Stats.connected = false after writes")
	}
	if n, _ := stats["active_missions"].(int); n != 2 {
		t.Errorf("Stats.active_missions = %d, want 2", n)
	}
}
