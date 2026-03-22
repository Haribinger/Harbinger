package main

import (
	"testing"
)

func TestV2EventTypesAccepted(t *testing.T) {
	// Verify all v2 event types are stored by publishEvent and
	// would pass the validTypes check in handleBroadcastEvent.
	v2Types := []string{
		EventTypeMissionUpdate,
		EventTypeTaskUpdate,
		EventTypeSubTaskUpdate,
		EventTypeActionUpdate,
		EventTypeToolOutput,
		EventTypeReactIteration,
	}

	for _, et := range v2Types {
		evt := RealtimeEvent{
			Type:    et,
			Source:  "test-v2",
			Target:  "broadcast",
			Channel: "test",
			Payload: map[string]any{"test": true},
		}
		publishEvent(evt)

		realtimeHub.RLock()
		found := false
		for _, e := range realtimeHub.events {
			if e.Type == et && e.Source == "test-v2" {
				found = true
				break
			}
		}
		realtimeHub.RUnlock()

		if !found {
			t.Errorf("v2 event type %q not found in ring buffer after publishEvent", et)
		}
	}
}

func TestV2EventTypesHaveConstants(t *testing.T) {
	// Ensure the constant values match what FastAPI event_bridge.py sends.
	expected := map[string]string{
		"EventTypeMissionUpdate":  "mission_update",
		"EventTypeTaskUpdate":     "task_update",
		"EventTypeSubTaskUpdate":  "subtask_update",
		"EventTypeActionUpdate":   "action_update",
		"EventTypeToolOutput":     "tool_output",
		"EventTypeReactIteration": "react_iteration",
	}

	actual := map[string]string{
		"EventTypeMissionUpdate":  EventTypeMissionUpdate,
		"EventTypeTaskUpdate":     EventTypeTaskUpdate,
		"EventTypeSubTaskUpdate":  EventTypeSubTaskUpdate,
		"EventTypeActionUpdate":   EventTypeActionUpdate,
		"EventTypeToolOutput":     EventTypeToolOutput,
		"EventTypeReactIteration": EventTypeReactIteration,
	}

	for name, want := range expected {
		got := actual[name]
		if got != want {
			t.Errorf("%s = %q, want %q", name, got, want)
		}
	}
}
