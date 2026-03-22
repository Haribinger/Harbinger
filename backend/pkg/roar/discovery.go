package roar

import (
	"sync"
	"time"
)

// Directory is a thread-safe in-memory agent registry.
type Directory struct {
	mu     sync.RWMutex
	agents map[string]DiscoveryEntry
}

// NewDirectory creates an empty agent directory.
func NewDirectory() *Directory {
	return &Directory{
		agents: make(map[string]DiscoveryEntry),
	}
}

// Register adds or updates an agent card in the directory.
func (d *Directory) Register(card AgentCard) DiscoveryEntry {
	now := time.Now()
	entry := DiscoveryEntry{
		Card:         card,
		RegisteredAt: now,
		LastSeen:     now,
	}
	d.mu.Lock()
	d.agents[card.Identity.DID] = entry
	d.mu.Unlock()
	return entry
}

// Unregister removes an agent from the directory. Returns false if not found.
func (d *Directory) Unregister(did string) bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	if _, ok := d.agents[did]; !ok {
		return false
	}
	delete(d.agents, did)
	return true
}

// Lookup returns the discovery entry for a DID, or nil if not found.
func (d *Directory) Lookup(did string) *DiscoveryEntry {
	d.mu.RLock()
	defer d.mu.RUnlock()
	entry, ok := d.agents[did]
	if !ok {
		return nil
	}
	return &entry
}

// Search finds all agents that advertise a given capability.
// Matches against both Identity.Capabilities and DeclaredCapabilities names.
func (d *Directory) Search(capability string) []DiscoveryEntry {
	d.mu.RLock()
	defer d.mu.RUnlock()

	var results []DiscoveryEntry
	for _, entry := range d.agents {
		if hasCapability(entry, capability) {
			results = append(results, entry)
		}
	}
	return results
}

func hasCapability(entry DiscoveryEntry, capability string) bool {
	for _, c := range entry.Card.Identity.Capabilities {
		if c == capability {
			return true
		}
	}
	for _, dc := range entry.Card.DeclaredCapabilities {
		if dc.Name == capability {
			return true
		}
	}
	return false
}

// ListAll returns every registered agent.
func (d *Directory) ListAll() []DiscoveryEntry {
	d.mu.RLock()
	defer d.mu.RUnlock()

	results := make([]DiscoveryEntry, 0, len(d.agents))
	for _, entry := range d.agents {
		results = append(results, entry)
	}
	return results
}

// Heartbeat updates the LastSeen timestamp for an agent. Returns false if not found.
func (d *Directory) Heartbeat(did string) bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	entry, ok := d.agents[did]
	if !ok {
		return false
	}
	entry.LastSeen = time.Now()
	d.agents[did] = entry
	return true
}
