package roar

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// StreamFilter controls which events a stream subscription receives.
// If a filter list is non-empty, the event must match at least one entry in that list.
type StreamFilter struct {
	EventTypes []StreamEventType
	SourceDIDs []string
	SessionIDs []string
}

// Matches returns true if the event satisfies all non-empty filter criteria.
func (f *StreamFilter) Matches(event StreamEvent) bool {
	if len(f.EventTypes) > 0 {
		found := false
		for _, t := range f.EventTypes {
			if t == event.Type {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	if len(f.SourceDIDs) > 0 {
		found := false
		for _, d := range f.SourceDIDs {
			if d == event.Source {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	if len(f.SessionIDs) > 0 {
		found := false
		for _, s := range f.SessionIDs {
			if s == event.SessionID {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// StreamSubscription represents a single subscriber on the event bus.
type StreamSubscription struct {
	ID     string
	Filter StreamFilter
	Ch     chan StreamEvent
	Closed bool
}

// EventBus is a publish-subscribe bus for real-time stream events.
type EventBus struct {
	mu            sync.RWMutex
	subscriptions map[string]*StreamSubscription
	replayBuffer  []StreamEvent
	maxReplay     int
	counter       atomic.Int64
}

// NewEventBus creates an event bus with the given replay buffer size.
func NewEventBus(maxReplay int) *EventBus {
	if maxReplay <= 0 {
		maxReplay = 100
	}
	return &EventBus{
		subscriptions: make(map[string]*StreamSubscription),
		replayBuffer:  make([]StreamEvent, 0, maxReplay),
		maxReplay:     maxReplay,
	}
}

// genStreamSubID produces a unique subscription identifier.
func (eb *EventBus) genStreamSubID() string {
	n := eb.counter.Add(1)
	rb := make([]byte, 4)
	if _, err := rand.Read(rb); err != nil {
		panic(fmt.Sprintf("roar: crypto/rand failed: %v", err))
	}
	return fmt.Sprintf("ssub_%d_%s", n, hex.EncodeToString(rb))
}

// Subscribe creates a new stream subscription. If replay is true, matching events
// from the replay buffer are sent into the channel before returning.
func (eb *EventBus) Subscribe(filter StreamFilter, bufferSize int, replay bool) *StreamSubscription {
	if bufferSize <= 0 {
		bufferSize = 100
	}

	sub := &StreamSubscription{
		ID:     eb.genStreamSubID(),
		Filter: filter,
		Ch:     make(chan StreamEvent, bufferSize),
	}

	eb.mu.Lock()
	// Replay buffered events if requested
	if replay {
		for _, evt := range eb.replayBuffer {
			if filter.Matches(evt) {
				// Non-blocking send for replay as well
				select {
				case sub.Ch <- evt:
				default:
				}
			}
		}
	}
	eb.subscriptions[sub.ID] = sub
	eb.mu.Unlock()

	return sub
}

// Unsubscribe removes a subscription, closes its channel, and marks it closed.
func (eb *EventBus) Unsubscribe(subID string) {
	eb.mu.Lock()
	sub, ok := eb.subscriptions[subID]
	if ok {
		sub.Closed = true
		close(sub.Ch)
		delete(eb.subscriptions, subID)
	}
	eb.mu.Unlock()
}

// Emit broadcasts an event to all matching subscribers and stores it in the
// replay buffer. Returns the number of subscribers that received the event.
func (eb *EventBus) Emit(event StreamEvent) int {
	// Set timestamp if not already set
	if event.Timestamp == 0 {
		event.Timestamp = float64(time.Now().UnixMilli()) / 1000.0
	}

	eb.mu.Lock()
	defer eb.mu.Unlock()

	// Add to replay buffer (ring)
	if len(eb.replayBuffer) >= eb.maxReplay {
		// Shift out the oldest entry
		eb.replayBuffer = append(eb.replayBuffer[1:], event)
	} else {
		eb.replayBuffer = append(eb.replayBuffer, event)
	}

	// Deliver to matching subscriptions
	delivered := 0
	for _, sub := range eb.subscriptions {
		if sub.Closed {
			continue
		}
		if !sub.Filter.Matches(event) {
			continue
		}
		// Non-blocking send
		select {
		case sub.Ch <- event:
			delivered++
		default:
		}
	}
	return delivered
}
