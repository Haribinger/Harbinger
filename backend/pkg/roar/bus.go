package roar

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"sync/atomic"
)

// BusConfig controls message bus behavior.
type BusConfig struct {
	// Secret enables HMAC signature verification on published messages when non-empty.
	Secret string
	// MaxAge is the replay-protection window in seconds (0 = no replay check).
	MaxAge float64
	// BufferSize is the channel buffer for each subscription (default 100).
	BufferSize int
}

// Subscription represents a single subscriber on the message bus.
type Subscription struct {
	ID     string
	DID    string // target DID to match; empty string = wildcard (receive all)
	Filter func(*ROARMessage) bool
	Ch     chan ROARMessage
}

// Bus is a publish-subscribe message bus for ROAR protocol messages.
type Bus struct {
	config        BusConfig
	mu            sync.RWMutex
	subscriptions map[string]*Subscription
	counter       atomic.Int64
	dedupMu       sync.RWMutex
	dedup         map[string]bool
}

// NewBus creates a message bus with the given configuration.
func NewBus(cfg BusConfig) *Bus {
	if cfg.BufferSize <= 0 {
		cfg.BufferSize = 100
	}
	return &Bus{
		config:        cfg,
		subscriptions: make(map[string]*Subscription),
		dedup:         make(map[string]bool),
	}
}

// genSubID produces a unique subscription identifier.
func (b *Bus) genSubID() string {
	n := b.counter.Add(1)
	rb := make([]byte, 4)
	if _, err := rand.Read(rb); err != nil {
		panic(fmt.Sprintf("roar: crypto/rand failed: %v", err))
	}
	return fmt.Sprintf("sub_%d_%s", n, hex.EncodeToString(rb))
}

// Subscribe registers a subscription for messages addressed to the given DID.
// Returns the channel that will receive matching messages.
func (b *Bus) Subscribe(did string, filter func(*ROARMessage) bool) chan ROARMessage {
	sub := &Subscription{
		ID:     b.genSubID(),
		DID:    did,
		Filter: filter,
		Ch:     make(chan ROARMessage, b.config.BufferSize),
	}
	b.mu.Lock()
	b.subscriptions[sub.ID] = sub
	b.mu.Unlock()
	return sub.Ch
}

// SubscribeWithID registers a subscription and returns its ID for later unsubscribe.
func (b *Bus) SubscribeWithID(did string, filter func(*ROARMessage) bool) string {
	sub := &Subscription{
		ID:     b.genSubID(),
		DID:    did,
		Filter: filter,
		Ch:     make(chan ROARMessage, b.config.BufferSize),
	}
	b.mu.Lock()
	b.subscriptions[sub.ID] = sub
	b.mu.Unlock()
	return sub.ID
}

// SubscribeAll registers a wildcard subscription that receives all messages.
func (b *Bus) SubscribeAll(filter func(*ROARMessage) bool) chan ROARMessage {
	return b.Subscribe("", filter)
}

// Unsubscribe removes a subscription by ID and closes its channel.
func (b *Bus) Unsubscribe(subID string) {
	b.mu.Lock()
	sub, ok := b.subscriptions[subID]
	if ok {
		close(sub.Ch)
		delete(b.subscriptions, subID)
	}
	b.mu.Unlock()
}

// Publish sends a message to all matching subscribers. Returns the number of
// subscribers that received the message. If Secret is configured, the message
// signature is verified before delivery. Duplicate message IDs are silently dropped.
func (b *Bus) Publish(msg *ROARMessage) (int, error) {
	// Signature verification when secret is configured
	if b.config.Secret != "" {
		if !msg.Verify(b.config.Secret, b.config.MaxAge) {
			return 0, fmt.Errorf("roar: message signature verification failed")
		}
	}

	// Dedup by message ID
	b.dedupMu.RLock()
	seen := b.dedup[msg.ID]
	b.dedupMu.RUnlock()
	if seen {
		return 0, nil
	}

	b.dedupMu.Lock()
	// Prune cache when it gets too large
	if len(b.dedup) >= 10000 {
		b.dedup = make(map[string]bool)
	}
	b.dedup[msg.ID] = true
	b.dedupMu.Unlock()

	// Route to matching subscriptions
	b.mu.RLock()
	defer b.mu.RUnlock()

	delivered := 0
	for _, sub := range b.subscriptions {
		// DID match: subscription DID must be empty (wildcard) or match To.DID
		if sub.DID != "" && sub.DID != msg.To.DID {
			continue
		}
		// Apply user filter if present
		if sub.Filter != nil && !sub.Filter(msg) {
			continue
		}
		// Non-blocking send — drop on backpressure
		select {
		case sub.Ch <- *msg:
			delivered++
		default:
		}
	}
	return delivered, nil
}

// SubscriberCount returns the number of active subscriptions.
func (b *Bus) SubscriberCount() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.subscriptions)
}
