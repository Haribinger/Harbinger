package main

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ---- CVE Monitor Types ----

type CVEEntry struct {
	ID                string `json:"cveID"`
	VendorProject     string `json:"vendorProject"`
	Product           string `json:"product"`
	VulnerabilityName string `json:"vulnerabilityName"`
	DateAdded         string `json:"dateAdded"`
	ShortDescription  string `json:"shortDescription"`
	RequiredAction    string `json:"requiredAction"`
	DueDate           string `json:"dueDate"`
	KnownRansomware   string `json:"knownRansomwareCampaignUse"`
}

type CISAKEVCatalog struct {
	Title           string     `json:"title"`
	CatalogVersion  string     `json:"catalogVersion"`
	DateReleased    string     `json:"dateReleased"`
	Count           int        `json:"count"`
	Vulnerabilities []CVEEntry `json:"vulnerabilities"`
}

type CVEMatch struct {
	CVE    CVEEntry `json:"cve"`
	Target string   `json:"target"`
	Reason string   `json:"reason"`
}

// In-memory cache
var cveStore = struct {
	sync.RWMutex
	catalog   *CISAKEVCatalog
	fetchedAt time.Time
	matches   []CVEMatch
}{
	matches: []CVEMatch{},
}

const cisaKEVURL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"

func fetchCISAKEV() (*CISAKEVCatalog, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(cisaKEVURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 50<<20)) // 50MB limit — CISA KEV feed is large
	if err != nil {
		return nil, err
	}

	var catalog CISAKEVCatalog
	if err := json.Unmarshal(body, &catalog); err != nil {
		return nil, err
	}
	return &catalog, nil
}

func handleCVEFeed(w http.ResponseWriter, r *http.Request) {
	cveStore.RLock()
	cached := cveStore.catalog
	age := time.Since(cveStore.fetchedAt)
	cveStore.RUnlock()

	// Use cache if less than 1 hour old
	if cached != nil && age < time.Hour {
		// Apply filters
		vendor := r.URL.Query().Get("vendor")
		limit := 100

		vulns := cached.Vulnerabilities
		if vendor != "" {
			filtered := make([]CVEEntry, 0)
			for _, v := range vulns {
				if strings.EqualFold(v.VendorProject, vendor) {
					filtered = append(filtered, v)
				}
			}
			vulns = filtered
		}

		if len(vulns) > limit {
			vulns = vulns[len(vulns)-limit:]
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"ok":              true,
			"count":           len(vulns),
			"totalInCatalog":  cached.Count,
			"catalogVersion":  cached.CatalogVersion,
			"vulnerabilities": vulns,
			"cachedAt":        cveStore.fetchedAt.Format(time.RFC3339),
		})
		return
	}

	// Fetch fresh data
	catalog, err := fetchCISAKEV()
	if err != nil {
		// Return cached if available, even if stale
		if cached != nil {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"ok":              true,
				"count":           cached.Count,
				"vulnerabilities": cached.Vulnerabilities,
				"stale":           true,
				"error":           "refresh failed, serving cached data",
			})
			return
		}
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
			"ok":     false,
			"reason": "failed to fetch CISA KEV feed",
		})
		return
	}

	cveStore.Lock()
	cveStore.catalog = catalog
	cveStore.fetchedAt = time.Now()
	cveStore.Unlock()

	vulns := catalog.Vulnerabilities
	if len(vulns) > 100 {
		vulns = vulns[len(vulns)-100:]
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":              true,
		"count":           len(vulns),
		"totalInCatalog":  catalog.Count,
		"catalogVersion":  catalog.CatalogVersion,
		"vulnerabilities": vulns,
	})
}

func handleCVEMatching(w http.ResponseWriter, r *http.Request) {
	cveStore.RLock()
	defer cveStore.RUnlock()

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":      true,
		"matches": cveStore.matches,
		"count":   len(cveStore.matches),
	})
}

func handleCVERefresh(w http.ResponseWriter, r *http.Request) {
	catalog, err := fetchCISAKEV()
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
			"ok":     false,
			"reason": "failed to refresh CISA KEV feed",
		})
		return
	}

	cveStore.Lock()
	cveStore.catalog = catalog
	cveStore.fetchedAt = time.Now()
	cveStore.Unlock()

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":    true,
		"count": catalog.Count,
	})
}
