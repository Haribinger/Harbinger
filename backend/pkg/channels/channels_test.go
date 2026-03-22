package channels

import (
	"context"
	"testing"
	"time"

	"github.com/Haribinger/Harbinger/backend/pkg/roar"
)

// mockAdapter satisfies Adapter for testing purposes.
type mockAdapter struct {
	name     string
	started  bool
	messages []roar.ROARMessage
	incoming chan NativePayload
}

func newMockAdapter(name string) *mockAdapter {
	return &mockAdapter{
		name:     name,
		incoming: make(chan NativePayload, 10),
	}
}

func (m *mockAdapter) Name() string { return m.name }

func (m *mockAdapter) Connect(_ context.Context, _ AdapterConfig) error {
	m.started = true
	return nil
}

func (m *mockAdapter) Send(_ context.Context, msg roar.ROARMessage) error {
	m.messages = append(m.messages, msg)
	return nil
}

func (m *mockAdapter) Listen() <-chan NativePayload { return m.incoming }

func (m *mockAdapter) Disconnect(_ context.Context) error {
	m.started = false
	return nil
}

func (m *mockAdapter) HealthCheck(_ context.Context) error { return nil }

func TestManagerStartStop(t *testing.T) {
	mgr := NewManager()
	mock := newMockAdapter("test")
	mgr.RegisterAdapter(mock)

	if err := mgr.StartAll(context.Background()); err != nil {
		t.Fatalf("StartAll failed: %v", err)
	}

	if !mock.started {
		t.Fatal("expected adapter to be started after StartAll")
	}

	mgr.StopAll(context.Background())

	if mock.started {
		t.Fatal("expected adapter to be stopped after StopAll")
	}
}

func TestManagerRouteIncoming(t *testing.T) {
	mgr := NewManager()
	mock := newMockAdapter("test")
	mgr.RegisterAdapter(mock)

	if err := mgr.StartAll(context.Background()); err != nil {
		t.Fatalf("StartAll failed: %v", err)
	}
	defer mgr.StopAll(context.Background())

	// Inject a payload into the mock adapter's channel
	want := NativePayload{
		ChannelName: "test",
		SenderID:    "user-1",
		SessionID:   "sess-42",
		Content:     "hello from mock",
	}
	mock.incoming <- want

	// Read it back from the manager's unified channel
	select {
	case got := <-mgr.IncomingMessages():
		if got.Content != want.Content {
			t.Fatalf("content mismatch: got %q, want %q", got.Content, want.Content)
		}
		if got.SenderID != want.SenderID {
			t.Fatalf("sender mismatch: got %q, want %q", got.SenderID, want.SenderID)
		}
		if got.SessionID != want.SessionID {
			t.Fatalf("session mismatch: got %q, want %q", got.SessionID, want.SessionID)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for incoming message")
	}
}

func TestListAdapters(t *testing.T) {
	mgr := NewManager()
	mgr.RegisterAdapter(newMockAdapter("alpha"))
	mgr.RegisterAdapter(newMockAdapter("beta"))

	names := mgr.ListAdapters()
	if len(names) != 2 {
		t.Fatalf("expected 2 adapters, got %d", len(names))
	}

	found := map[string]bool{}
	for _, n := range names {
		found[n] = true
	}
	if !found["alpha"] || !found["beta"] {
		t.Fatalf("expected alpha and beta, got %v", names)
	}
}

func TestGetAdapter(t *testing.T) {
	mgr := NewManager()
	mock := newMockAdapter("discord")
	mgr.RegisterAdapter(mock)

	got := mgr.GetAdapter("discord")
	if got == nil {
		t.Fatal("expected adapter, got nil")
	}
	if got.Name() != "discord" {
		t.Fatalf("expected discord, got %s", got.Name())
	}

	if mgr.GetAdapter("nonexistent") != nil {
		t.Fatal("expected nil for unknown adapter")
	}
}
