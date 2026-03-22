package channels

import (
	"context"
	"fmt"
	"sync"
)

// Manager orchestrates a set of chat-platform adapters,
// funnelling all inbound messages into a single channel.
type Manager struct {
	mu       sync.RWMutex
	adapters map[string]Adapter
	incoming chan NativePayload
	cancel   context.CancelFunc
}

// NewManager returns a Manager ready to accept adapter registrations.
func NewManager() *Manager {
	return &Manager{
		adapters: make(map[string]Adapter),
		incoming: make(chan NativePayload, 100),
	}
}

// RegisterAdapter stores an adapter keyed by its Name().
func (m *Manager) RegisterAdapter(a Adapter) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.adapters[a.Name()] = a
}

// IncomingMessages returns a read-only channel that emits every
// NativePayload received from any connected adapter.
func (m *Manager) IncomingMessages() <-chan NativePayload {
	return m.incoming
}

// StartAll connects every registered adapter and spawns a listener
// goroutine for each one. Call StopAll to tear everything down.
func (m *Manager) StartAll(ctx context.Context) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ctx, cancel := context.WithCancel(ctx)
	m.cancel = cancel

	for name, a := range m.adapters {
		if err := a.Connect(ctx, AdapterConfig{}); err != nil {
			cancel()
			return fmt.Errorf("channels: connect %s: %w", name, err)
		}
		go m.listenAdapter(ctx, a)
	}
	return nil
}

// listenAdapter drains an adapter's Listen channel and forwards
// payloads into the manager's unified incoming channel.
func (m *Manager) listenAdapter(ctx context.Context, a Adapter) {
	ch := a.Listen()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			select {
			case m.incoming <- msg:
			case <-ctx.Done():
				return
			}
		}
	}
}

// StopAll cancels the shared context and disconnects every adapter.
func (m *Manager) StopAll(ctx context.Context) {
	if m.cancel != nil {
		m.cancel()
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, a := range m.adapters {
		// best-effort disconnect; errors are swallowed intentionally
		_ = a.Disconnect(ctx)
	}
}

// GetAdapter returns the adapter registered under the given name, or nil.
func (m *Manager) GetAdapter(name string) Adapter {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.adapters[name]
}

// ListAdapters returns the names of all registered adapters.
func (m *Manager) ListAdapters() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	names := make([]string, 0, len(m.adapters))
	for n := range m.adapters {
		names = append(names, n)
	}
	return names
}
