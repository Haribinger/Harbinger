// Package memorylayer implements the L1–L3 memory hierarchy for Harbinger v2.0.
//
// L1 is Redis-backed working memory — mission-scoped, ephemeral, auto-expiring.
// Think of it as the "CPU register" of the agent: fast, volatile, and mission-bound.
// When a mission ends (or its TTL elapses) the keys evaporate automatically.
//
// Key schema:
//
//	harbinger:wm:{missionID}:{key}           — simple string value
//	harbinger:wm:{missionID}:list:{key}      — ordered list (e.g. findings accumulator)
package memorylayer

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	// wmPrefix is prepended to every Redis key owned by this package.
	wmPrefix = "harbinger:wm:"

	// defaultTTL is used when WorkingMemoryConfig.TTL is zero.
	// Four hours covers any realistic mission window without leaking state indefinitely.
	defaultTTL = 4 * time.Hour

	// scanBatch controls how many keys are requested per SCAN cursor page.
	scanBatch = 100

	// listSegment is the fixed path segment that distinguishes list keys from plain keys.
	// GetAll skips any key whose Redis name contains this segment so that list entries
	// are only accessible via GetList.
	listSegment = ":list:"
)

// WorkingMemory is L1 — mission-scoped ephemeral context stored in Redis.
// All keys are namespaced under the mission ID and auto-expire after TTL.
// The zero value is not usable; construct via NewWorkingMemory.
type WorkingMemory struct {
	client *redis.Client
	ttl    time.Duration
}

// WorkingMemoryConfig holds Redis connection parameters for NewWorkingMemory.
type WorkingMemoryConfig struct {
	// Host is the Redis server hostname or IP.  Defaults to "localhost".
	Host string

	// Port is the Redis server TCP port.  Defaults to "6379".
	Port string

	// TTL is the expiry applied to every key written by this instance.
	// Defaults to 4 hours when zero.
	TTL time.Duration
}

// NewWorkingMemory creates and validates a WorkingMemory instance.
//
// The constructor pings Redis before returning so callers discover connectivity
// failures immediately rather than at first use.  If Redis is unreachable the
// returned error wraps the underlying cause; callers should log a warning and
// continue without L1 rather than treating this as fatal.
func NewWorkingMemory(cfg WorkingMemoryConfig) (*WorkingMemory, error) {
	if cfg.Host == "" {
		cfg.Host = "localhost"
	}
	if cfg.Port == "" {
		cfg.Port = "6379"
	}
	if cfg.TTL <= 0 {
		cfg.TTL = defaultTTL
	}

	client := redis.NewClient(&redis.Options{
		Addr: cfg.Host + ":" + cfg.Port,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		// Best-effort close; ignore secondary error.
		_ = client.Close()
		return nil, fmt.Errorf("memorylayer: working: ping failed: %w", err)
	}

	return &WorkingMemory{
		client: client,
		ttl:    cfg.TTL,
	}, nil
}

// Close releases the underlying Redis connection pool.
func (wm *WorkingMemory) Close() error {
	return wm.client.Close()
}

// Set stores a string value under the given key within a mission's namespace.
//
// The key expires automatically after the TTL configured at construction time.
// Overwriting an existing key resets the TTL.
func (wm *WorkingMemory) Set(ctx context.Context, missionID, key, value string) error {
	rk := wm.kvKey(missionID, key)
	if err := wm.client.Set(ctx, rk, value, wm.ttl).Err(); err != nil {
		return fmt.Errorf("memorylayer: working: set %q: %w", rk, err)
	}
	return nil
}

// Get retrieves the string value for the given key within a mission's namespace.
//
// A missing key is not an error — the function returns ("", nil) in that case.
// Only genuine Redis failures produce a non-nil error.
func (wm *WorkingMemory) Get(ctx context.Context, missionID, key string) (string, error) {
	rk := wm.kvKey(missionID, key)
	val, err := wm.client.Get(ctx, rk).Result()
	if err == redis.Nil {
		// Key absent — not an error for working memory.
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("memorylayer: working: get %q: %w", rk, err)
	}
	return val, nil
}

// GetAll returns every plain key-value pair in a mission's namespace.
//
// List keys (those containing ":list:" in their Redis path) are excluded;
// retrieve them individually with GetList.  The returned map uses the
// bare key name (without the namespace prefix) so callers work with the
// same identifiers they passed to Set.
func (wm *WorkingMemory) GetAll(ctx context.Context, missionID string) (map[string]string, error) {
	pattern := wmPrefix + missionID + ":*"
	keys, err := wm.scanKeys(ctx, pattern)
	if err != nil {
		return nil, fmt.Errorf("memorylayer: working: getall scan: %w", err)
	}

	prefix := wmPrefix + missionID + ":"
	result := make(map[string]string, len(keys))

	for _, rk := range keys {
		// Skip list keys — they need LRANGE, not GET.
		if strings.Contains(rk, listSegment) {
			continue
		}

		val, err := wm.client.Get(ctx, rk).Result()
		if err == redis.Nil {
			// Key evicted between SCAN and GET — harmless race.
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("memorylayer: working: getall get %q: %w", rk, err)
		}

		// Strip the namespace prefix so the caller sees the bare key.
		bareKey := strings.TrimPrefix(rk, prefix)
		result[bareKey] = val
	}

	return result, nil
}

// Append pushes a value onto the tail of a list stored under the given key
// within a mission's namespace.
//
// This is the primary accumulation primitive for findings and evidence collected
// during a mission.  The list TTL is reset on every append so active missions
// don't lose data mid-operation.
func (wm *WorkingMemory) Append(ctx context.Context, missionID, key, value string) error {
	rk := wm.listKey(missionID, key)
	pipe := wm.client.Pipeline()
	pipe.RPush(ctx, rk, value)
	pipe.Expire(ctx, rk, wm.ttl)
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("memorylayer: working: append %q: %w", rk, err)
	}
	return nil
}

// GetList returns all values that have been appended to the given key within
// a mission's namespace, in insertion order.
//
// An empty or absent list returns ([]string{}, nil).
func (wm *WorkingMemory) GetList(ctx context.Context, missionID, key string) ([]string, error) {
	rk := wm.listKey(missionID, key)
	vals, err := wm.client.LRange(ctx, rk, 0, -1).Result()
	if err != nil {
		return nil, fmt.Errorf("memorylayer: working: getlist %q: %w", rk, err)
	}
	return vals, nil
}

// Clear removes every key (both plain and list) belonging to the given mission.
//
// Deletion is performed in batches of 100 keys to avoid blocking Redis.
// Returns nil even when there are no keys to delete.
func (wm *WorkingMemory) Clear(ctx context.Context, missionID string) error {
	pattern := wmPrefix + missionID + ":*"
	keys, err := wm.scanKeys(ctx, pattern)
	if err != nil {
		return fmt.Errorf("memorylayer: working: clear scan: %w", err)
	}

	for i := 0; i < len(keys); i += scanBatch {
		end := i + scanBatch
		if end > len(keys) {
			end = len(keys)
		}
		batch := keys[i:end]
		if err := wm.client.Del(ctx, batch...).Err(); err != nil {
			return fmt.Errorf("memorylayer: working: clear del batch: %w", err)
		}
	}

	return nil
}

// Stats returns a lightweight health summary for the L1 layer.
//
// The "active_missions" count is derived by scanning all harbinger:wm:* keys
// and counting distinct mission ID segments — it is approximate under concurrent
// write load but accurate enough for dashboard display.
//
// If Redis is unreachable the function returns {"connected": false,
// "active_missions": 0} rather than an error, so callers can surface
// degraded-mode status without breaking the request path.
func (wm *WorkingMemory) Stats(ctx context.Context) (map[string]any, error) {
	if err := wm.client.Ping(ctx).Err(); err != nil {
		return map[string]any{
			"connected":       false,
			"active_missions": 0,
		}, nil
	}

	keys, err := wm.scanKeys(ctx, wmPrefix+"*")
	if err != nil {
		// Redis is reachable (ping passed) but scan failed — surface the count as 0.
		return map[string]any{
			"connected":       true,
			"active_missions": 0,
		}, fmt.Errorf("memorylayer: working: stats scan: %w", err)
	}

	// Extract the mission ID from each key (third colon-delimited segment).
	// Key format: harbinger:wm:{missionID}:{...}
	missions := make(map[string]struct{})
	for _, k := range keys {
		// Strip the fixed prefix "harbinger:wm:" then take everything up to
		// the next ":" to isolate the missionID segment.
		rest := strings.TrimPrefix(k, wmPrefix)
		if idx := strings.Index(rest, ":"); idx >= 0 {
			missions[rest[:idx]] = struct{}{}
		}
	}

	return map[string]any{
		"connected":       true,
		"active_missions": len(missions),
	}, nil
}

// ---- internal helpers --------------------------------------------------------

// kvKey builds the Redis key for a plain string value.
func (wm *WorkingMemory) kvKey(missionID, key string) string {
	return wmPrefix + missionID + ":" + key
}

// listKey builds the Redis key for an ordered list.
func (wm *WorkingMemory) listKey(missionID, key string) string {
	// listSegment already contains leading and trailing colons.
	return wmPrefix + missionID + listSegment + key
}

// scanKeys performs a full cursor-based SCAN for the given pattern and returns
// all matching keys.  It never uses KEYS to avoid blocking the Redis server
// under high key counts.
func (wm *WorkingMemory) scanKeys(ctx context.Context, pattern string) ([]string, error) {
	var (
		cursor uint64
		keys   []string
	)

	for {
		batch, nextCursor, err := wm.client.Scan(ctx, cursor, pattern, scanBatch).Result()
		if err != nil {
			return nil, fmt.Errorf("scan cursor %d pattern %q: %w", cursor, pattern, err)
		}
		keys = append(keys, batch...)
		if nextCursor == 0 {
			break
		}
		cursor = nextCursor
	}

	return keys, nil
}
