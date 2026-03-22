package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// cve.go — Enhanced CVE Monitor with multi-source ingestion.
// Pulls from CISA KEV, NVD, GitHub Advisories, and any user-configured feeds.
// Provides filtering, CVSS scores, and scope-based matching.

// ---- Types ----

type CVESource struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	URL      string `json:"url"`
	Type     string `json:"type"`    // "cisa_kev", "nvd", "github", "custom_feed"
	Enabled  bool   `json:"enabled"`
	Interval int    `json:"interval"` // refresh interval in minutes
	APIKey   string `json:"apiKey,omitempty"`
}

type EnrichedCVE struct {
	ID                string   `json:"cveID"`
	VendorProject     string   `json:"vendorProject"`
	Product           string   `json:"product"`
	VulnerabilityName string   `json:"vulnerabilityName"`
	DateAdded         string   `json:"dateAdded"`
	ShortDescription  string   `json:"shortDescription"`
	RequiredAction    string   `json:"requiredAction"`
	DueDate           string   `json:"dueDate"`
	KnownRansomware   string   `json:"knownRansomwareCampaignUse"`
	CVSSScore         float64  `json:"cvssScore"`
	Severity          string   `json:"severity"` // critical, high, medium, low
	References        []string `json:"references"`
	Source            string   `json:"source"` // which feed this came from
	AffectedVersions  string   `json:"affectedVersions"`
	ExploitAvailable  bool     `json:"exploitAvailable"`
}

// CVEMatch pairs a matched CVE with the scope asset that triggered the match.
type CVEMatch struct {
	CVE    EnrichedCVE `json:"cve"`
	Target string      `json:"target"`
	Reason string      `json:"reason"`
}

// ---- NVD 2.0 API response structs ----

type NVDResponse struct {
	ResultsPerPage  int `json:"resultsPerPage"`
	TotalResults    int `json:"totalResults"`
	Vulnerabilities []struct {
		CVE struct {
			ID           string `json:"id"`
			Descriptions []struct {
				Lang  string `json:"lang"`
				Value string `json:"value"`
			} `json:"descriptions"`
			Metrics struct {
				CVSSMetricV31 []struct {
					CVSSData struct {
						BaseScore    float64 `json:"baseScore"`
						BaseSeverity string  `json:"baseSeverity"`
					} `json:"cvssData"`
				} `json:"cvssMetricV31"`
				// Fall back to v2 when v3 is unavailable
				CVSSMetricV2 []struct {
					CVSSData struct {
						BaseScore float64 `json:"baseScore"`
					} `json:"cvssData"`
					BaseSeverity string `json:"baseSeverity"`
				} `json:"cvssMetricV2"`
			} `json:"metrics"`
			References []struct {
				URL string `json:"url"`
			} `json:"references"`
			Published string `json:"published"`
		} `json:"cve"`
	} `json:"vulnerabilities"`
}

// ---- GitHub Advisories API response structs ----

type GitHubAdvisory struct {
	GHSAID      string `json:"ghsa_id"`
	CVEID       string `json:"cve_id"`
	Summary     string `json:"summary"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
	CVSS        struct {
		Score float64 `json:"score"`
	} `json:"cvss"`
	References []struct {
		URL string `json:"url"`
	} `json:"references"`
	PublishedAt string `json:"published_at"`
}

// ---- CISA KEV catalog struct (unchanged shape from original feed) ----

type CISAKEVCatalog struct {
	Title          string       `json:"title"`
	CatalogVersion string       `json:"catalogVersion"`
	DateReleased   string       `json:"dateReleased"`
	Count          int          `json:"count"`
	Vulnerabilities []cisaEntry `json:"vulnerabilities"`
}

// cisaEntry is the raw CISA KEV row before enrichment.
type cisaEntry struct {
	CveID                      string `json:"cveID"`
	VendorProject              string `json:"vendorProject"`
	Product                    string `json:"product"`
	VulnerabilityName          string `json:"vulnerabilityName"`
	DateAdded                  string `json:"dateAdded"`
	ShortDescription           string `json:"shortDescription"`
	RequiredAction             string `json:"requiredAction"`
	DueDate                    string `json:"dueDate"`
	KnownRansomwareCampaignUse string `json:"knownRansomwareCampaignUse"`
}

// ---- In-memory store ----

var cveStore = struct {
	sync.RWMutex
	// Unified slice of enriched CVEs across all sources
	cves      []EnrichedCVE
	fetchedAt map[string]time.Time // per-source last-fetch timestamps
	sources   []CVESource
	matches   []CVEMatch
}{
	cves:      []EnrichedCVE{},
	fetchedAt: make(map[string]time.Time),
	sources:   []CVESource{},
	matches:   []CVEMatch{},
}

// defaultSources are always present; users can add more via the API.
var defaultSources = []CVESource{
	{
		ID:       "cisa-kev",
		Name:     "CISA KEV",
		URL:      "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
		Type:     "cisa_kev",
		Enabled:  true,
		Interval: 60,
	},
	{
		ID:       "nvd-recent",
		Name:     "NVD Recent",
		URL:      "https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=100",
		Type:     "nvd",
		Enabled:  true,
		Interval: 120,
	},
	{
		ID:       "github-advisories",
		Name:     "GitHub Advisories",
		URL:      "https://api.github.com/advisories?per_page=100&type=reviewed",
		Type:     "github",
		Enabled:  true,
		Interval: 120,
	},
}

func init() {
	cveStore.sources = make([]CVESource, len(defaultSources))
	copy(cveStore.sources, defaultSources)
}

// ---- Severity helpers ----

func cvssToSeverity(score float64) string {
	switch {
	case score >= 9.0:
		return "critical"
	case score >= 7.0:
		return "high"
	case score >= 4.0:
		return "medium"
	case score > 0:
		return "low"
	default:
		return "unknown"
	}
}

// ---- Source fetchers ----

func fetchFromCISAKEV(src CVESource) ([]EnrichedCVE, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(src.URL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 50<<20))
	if err != nil {
		return nil, err
	}

	var catalog CISAKEVCatalog
	if err := json.Unmarshal(body, &catalog); err != nil {
		return nil, err
	}

	out := make([]EnrichedCVE, 0, len(catalog.Vulnerabilities))
	for _, e := range catalog.Vulnerabilities {
		exploitable := strings.EqualFold(e.KnownRansomwareCampaignUse, "known") ||
			strings.EqualFold(e.KnownRansomwareCampaignUse, "known ransomware campaign use")

		out = append(out, EnrichedCVE{
			ID:                e.CveID,
			VendorProject:     e.VendorProject,
			Product:           e.Product,
			VulnerabilityName: e.VulnerabilityName,
			DateAdded:         e.DateAdded,
			ShortDescription:  e.ShortDescription,
			RequiredAction:    e.RequiredAction,
			DueDate:           e.DueDate,
			KnownRansomware:   e.KnownRansomwareCampaignUse,
			CVSSScore:         0, // CISA KEV doesn't include CVSS; NVD enrichment would add it
			Severity:          "high", // CISA KEV only lists actively exploited, bias toward high
			References:        []string{},
			Source:            src.ID,
			ExploitAvailable:  exploitable,
		})
	}
	return out, nil
}

func fetchFromNVD(src CVESource) ([]EnrichedCVE, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequest("GET", src.URL, nil)
	if err != nil {
		return nil, err
	}
	// NVD recommends an API key to avoid rate limits; optional
	if src.APIKey != "" {
		req.Header.Set("apiKey", src.APIKey)
	}
	req.Header.Set("User-Agent", "Harbinger-CVEMonitor/1.2")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 20<<20))
	if err != nil {
		return nil, err
	}

	var nvd NVDResponse
	if err := json.Unmarshal(body, &nvd); err != nil {
		return nil, err
	}

	out := make([]EnrichedCVE, 0, len(nvd.Vulnerabilities))
	for _, v := range nvd.Vulnerabilities {
		cve := v.CVE

		// Pull English description
		desc := ""
		for _, d := range cve.Descriptions {
			if d.Lang == "en" {
				desc = d.Value
				break
			}
		}

		// CVSS v3.1 preferred, fall back to v2
		var score float64
		severity := "unknown"
		if len(cve.Metrics.CVSSMetricV31) > 0 {
			score = cve.Metrics.CVSSMetricV31[0].CVSSData.BaseScore
			severity = strings.ToLower(cve.Metrics.CVSSMetricV31[0].CVSSData.BaseSeverity)
		} else if len(cve.Metrics.CVSSMetricV2) > 0 {
			score = cve.Metrics.CVSSMetricV2[0].CVSSData.BaseScore
			severity = strings.ToLower(cve.Metrics.CVSSMetricV2[0].BaseSeverity)
		}
		if severity == "" {
			severity = cvssToSeverity(score)
		}

		refs := make([]string, 0, len(cve.References))
		for _, r := range cve.References {
			refs = append(refs, r.URL)
		}

		// Published date as dateAdded
		dateAdded := ""
		if len(cve.Published) >= 10 {
			dateAdded = cve.Published[:10]
		}

		out = append(out, EnrichedCVE{
			ID:               cve.ID,
			ShortDescription: desc,
			DateAdded:        dateAdded,
			CVSSScore:        score,
			Severity:         severity,
			References:       refs,
			Source:           src.ID,
		})
	}
	return out, nil
}

func fetchFromGitHub(src CVESource) ([]EnrichedCVE, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequest("GET", src.URL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "Harbinger-CVEMonitor/1.2")
	if src.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+src.APIKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
	if err != nil {
		return nil, err
	}

	var advisories []GitHubAdvisory
	if err := json.Unmarshal(body, &advisories); err != nil {
		return nil, err
	}

	out := make([]EnrichedCVE, 0, len(advisories))
	for _, a := range advisories {
		// Some advisories don't have a CVE ID; use GHSA ID as fallback
		id := a.CVEID
		if id == "" {
			id = a.GHSAID
		}
		if id == "" {
			continue
		}

		refs := make([]string, 0, len(a.References))
		for _, r := range a.References {
			refs = append(refs, r.URL)
		}

		dateAdded := ""
		if len(a.PublishedAt) >= 10 {
			dateAdded = a.PublishedAt[:10]
		}

		severity := strings.ToLower(a.Severity)
		if severity == "" {
			severity = cvssToSeverity(a.CVSS.Score)
		}

		out = append(out, EnrichedCVE{
			ID:               id,
			VulnerabilityName: a.Summary,
			ShortDescription: a.Description,
			DateAdded:        dateAdded,
			CVSSScore:        a.CVSS.Score,
			Severity:         severity,
			References:       refs,
			Source:           src.ID,
		})
	}
	return out, nil
}

// fetchFromCustomFeed handles a generic JSON feed.
// Expects either a CISA-KEV-shaped catalog or a bare array of EnrichedCVE objects.
func fetchFromCustomFeed(src CVESource) ([]EnrichedCVE, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequest("GET", src.URL, nil)
	if err != nil {
		return nil, err
	}
	if src.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+src.APIKey)
	}
	req.Header.Set("User-Agent", "Harbinger-CVEMonitor/1.2")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 20<<20))
	if err != nil {
		return nil, err
	}

	// Try bare array first
	var arr []EnrichedCVE
	if json.Unmarshal(body, &arr) == nil && len(arr) > 0 {
		for i := range arr {
			arr[i].Source = src.ID
			if arr[i].Severity == "" {
				arr[i].Severity = cvssToSeverity(arr[i].CVSSScore)
			}
		}
		return arr, nil
	}

	// Try CISA KEV catalog shape as fallback
	return fetchFromCISAKEV(src)
}

// refreshSource fetches CVEs for a single source and merges into cveStore.
// Existing CVEs from the same source are replaced; other sources are kept.
func refreshSource(src CVESource) error {
	var fresh []EnrichedCVE
	var err error

	switch src.Type {
	case "cisa_kev":
		fresh, err = fetchFromCISAKEV(src)
	case "nvd":
		fresh, err = fetchFromNVD(src)
	case "github":
		fresh, err = fetchFromGitHub(src)
	default:
		fresh, err = fetchFromCustomFeed(src)
	}
	if err != nil {
		return err
	}

	cveStore.Lock()
	defer cveStore.Unlock()

	// Remove stale entries from this source, then append fresh ones.
	kept := cveStore.cves[:0]
	for _, c := range cveStore.cves {
		if c.Source != src.ID {
			kept = append(kept, c)
		}
	}
	cveStore.cves = append(kept, fresh...)
	cveStore.fetchedAt[src.ID] = time.Now()
	return nil
}

// refreshAllSources triggers a fetch for every enabled source.
func refreshAllSources() {
	cveStore.RLock()
	sources := make([]CVESource, len(cveStore.sources))
	copy(sources, cveStore.sources)
	cveStore.RUnlock()

	for _, src := range sources {
		if !src.Enabled {
			continue
		}
		if err := refreshSource(src); err != nil {
			log.Printf("[CVE] refresh failed for source %s: %v", src.ID, err)
		}
	}
}

// ---- Filtering helpers ----

func filterCVEs(cves []EnrichedCVE, severity, vendor, product, search string) []EnrichedCVE {
	if severity == "" && vendor == "" && product == "" && search == "" {
		return cves
	}
	out := make([]EnrichedCVE, 0, len(cves))
	searchLow := strings.ToLower(search)
	for _, c := range cves {
		if severity != "" && !strings.EqualFold(c.Severity, severity) {
			continue
		}
		if vendor != "" && !strings.Contains(strings.ToLower(c.VendorProject), strings.ToLower(vendor)) {
			continue
		}
		if product != "" && !strings.Contains(strings.ToLower(c.Product), strings.ToLower(product)) {
			continue
		}
		if searchLow != "" {
			haystack := strings.ToLower(c.ID + " " + c.VulnerabilityName + " " + c.ShortDescription + " " + c.VendorProject + " " + c.Product)
			if !strings.Contains(haystack, searchLow) {
				continue
			}
		}
		out = append(out, c)
	}
	return out
}

// ---- Handlers ----

// GET /api/cve/feed — list CVEs with optional filters and pagination.
// Query params: severity, vendor, product, search, limit (default 100), offset (default 0)
func handleCVEFeed(w http.ResponseWriter, r *http.Request) {
	// Trigger a background refresh if no data yet, or if all sources are stale.
	cveStore.RLock()
	empty := len(cveStore.cves) == 0
	cveStore.RUnlock()

	if empty {
		go refreshAllSources()
	}

	q := r.URL.Query()
	severity := q.Get("severity")
	vendor := q.Get("vendor")
	product := q.Get("product")
	search := q.Get("search")
	limit := 100
	offset := 0

	if l := q.Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 1000 {
			limit = n
		}
	}
	if o := q.Get("offset"); o != "" {
		if n, err := strconv.Atoi(o); err == nil && n >= 0 {
			offset = n
		}
	}

	cveStore.RLock()
	allCVEs := make([]EnrichedCVE, len(cveStore.cves))
	copy(allCVEs, cveStore.cves)
	cveStore.RUnlock()

	filtered := filterCVEs(allCVEs, severity, vendor, product, search)
	total := len(filtered)

	// Apply pagination
	if offset >= total {
		filtered = []EnrichedCVE{}
	} else {
		filtered = filtered[offset:]
		if len(filtered) > limit {
			filtered = filtered[:limit]
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"total": total,
		"count": len(filtered),
		"items": filtered,
	})
}

// GET /api/cve/{id} — look up a single CVE by ID (e.g. CVE-2024-1234 or GHSA-xxx-xxx)
func handleGetCVEByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "id required"})
		return
	}

	cveStore.RLock()
	defer cveStore.RUnlock()

	for _, c := range cveStore.cves {
		if strings.EqualFold(c.ID, id) {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "cve": c})
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "CVE not found in any active feed"})
}

// POST /api/cve/refresh — force-refresh all enabled sources
func handleCVERefresh(w http.ResponseWriter, r *http.Request) {
	go refreshAllSources()
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "refresh triggered for all enabled sources",
	})
}

// GET /api/cve/match — match CVEs against current scope assets
func handleCVEMatching(w http.ResponseWriter, r *http.Request) {
	scopeMu.RLock()
	assets := make([]ScopeAsset, len(scopeAssets))
	copy(assets, scopeAssets)
	scopeMu.RUnlock()

	cveStore.RLock()
	allCVEs := make([]EnrichedCVE, len(cveStore.cves))
	copy(allCVEs, cveStore.cves)
	cveStore.RUnlock()

	matches := make([]CVEMatch, 0)

	for _, asset := range assets {
		patternLow := strings.ToLower(asset.Pattern)
		// Strip leading wildcard for matching (*.example.com → example.com)
		patternLow = strings.TrimPrefix(patternLow, "*.")

		for _, cve := range allCVEs {
			vendorLow := strings.ToLower(cve.VendorProject)
			productLow := strings.ToLower(cve.Product)
			descLow := strings.ToLower(cve.ShortDescription)

			var reason string
			switch {
			case strings.Contains(vendorLow, patternLow) || strings.Contains(patternLow, vendorLow):
				reason = fmt.Sprintf("vendor match: %q ~ scope asset %q", cve.VendorProject, asset.Pattern)
			case strings.Contains(productLow, patternLow) || strings.Contains(patternLow, productLow):
				reason = fmt.Sprintf("product match: %q ~ scope asset %q", cve.Product, asset.Pattern)
			case strings.Contains(descLow, patternLow):
				reason = fmt.Sprintf("description mention of scope asset %q", asset.Pattern)
			}

			if reason != "" {
				matches = append(matches, CVEMatch{
					CVE:    cve,
					Target: asset.Pattern,
					Reason: reason,
				})
			}
		}
	}

	// Update stored matches for the legacy /matches endpoint
	cveStore.Lock()
	cveStore.matches = matches
	cveStore.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"matches": matches,
		"count":   len(matches),
	})
}

// GET /api/cve/sources — list all configured sources (default + custom)
func handleListCVESources(w http.ResponseWriter, r *http.Request) {
	cveStore.RLock()
	defer cveStore.RUnlock()

	// Build response with last-fetched timestamp per source
	type sourceView struct {
		CVESource
		LastFetched string `json:"lastFetched,omitempty"`
	}
	out := make([]sourceView, 0, len(cveStore.sources))
	for _, s := range cveStore.sources {
		sv := sourceView{CVESource: s}
		// Never leak API keys to the frontend
		sv.APIKey = ""
		if t, ok := cveStore.fetchedAt[s.ID]; ok {
			sv.LastFetched = t.Format(time.RFC3339)
		}
		out = append(out, sv)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"sources": out,
		"count":   len(out),
	})
}

// POST /api/cve/sources — add a custom source
func handleAddCVESource(w http.ResponseWriter, r *http.Request) {
	var body CVESource
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}
	if body.URL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "url required"})
		return
	}
	if body.Name == "" {
		body.Name = body.URL
	}
	if body.Type == "" {
		body.Type = "custom_feed"
	}
	if body.Interval <= 0 {
		body.Interval = 60
	}

	// Generate a stable ID from name if not provided
	if body.ID == "" {
		body.ID = fmt.Sprintf("custom-%d", time.Now().UnixMilli())
	}
	body.Enabled = true

	cveStore.Lock()
	// Prevent duplicate IDs
	for _, s := range cveStore.sources {
		if s.ID == body.ID {
			cveStore.Unlock()
			writeJSON(w, http.StatusConflict, map[string]any{"ok": false, "error": "source id already exists"})
			return
		}
	}
	cveStore.sources = append(cveStore.sources, body)
	cveStore.Unlock()

	// Kick off an immediate fetch for the new source
	go func() {
		if err := refreshSource(body); err != nil {
			log.Printf("[CVE] initial fetch failed for new source %s: %v", body.ID, err)
		}
	}()

	safeBody := body
	safeBody.APIKey = "" // never echo back the key
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "source": safeBody})
}

// PUT /api/cve/sources/{id} — update a source (enable/disable, change interval, etc.)
func handleUpdateCVESource(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var patch struct {
		Enabled  *bool   `json:"enabled"`
		Interval *int    `json:"interval"`
		Name     *string `json:"name"`
		APIKey   *string `json:"apiKey"`
	}
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}

	cveStore.Lock()
	defer cveStore.Unlock()

	for i, s := range cveStore.sources {
		if s.ID != id {
			continue
		}
		if patch.Enabled != nil {
			cveStore.sources[i].Enabled = *patch.Enabled
		}
		if patch.Interval != nil && *patch.Interval > 0 {
			cveStore.sources[i].Interval = *patch.Interval
		}
		if patch.Name != nil && *patch.Name != "" {
			cveStore.sources[i].Name = *patch.Name
		}
		if patch.APIKey != nil {
			cveStore.sources[i].APIKey = *patch.APIKey
		}
		updated := cveStore.sources[i]
		updated.APIKey = "" // never send back
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "source": updated})
		return
	}

	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "source not found"})
}

// DELETE /api/cve/sources/{id} — remove a custom source (default sources cannot be deleted)
func handleDeleteCVESource(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	// Guard: default sources are protected
	for _, d := range defaultSources {
		if d.ID == id {
			writeJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "cannot delete a built-in source"})
			return
		}
	}

	cveStore.Lock()
	defer cveStore.Unlock()

	for i, s := range cveStore.sources {
		if s.ID == id {
			cveStore.sources = append(cveStore.sources[:i], cveStore.sources[i+1:]...)
			// Purge CVEs that came from this source
			kept := cveStore.cves[:0]
			for _, c := range cveStore.cves {
				if c.Source != id {
					kept = append(kept, c)
				}
			}
			cveStore.cves = kept
			delete(cveStore.fetchedAt, id)
			writeJSON(w, http.StatusOK, map[string]any{"ok": true})
			return
		}
	}

	writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "source not found"})
}

// GET /api/cve/stats — summary counts across all loaded CVEs
func handleCVEStats(w http.ResponseWriter, r *http.Request) {
	cveStore.RLock()
	defer cveStore.RUnlock()

	bySource := make(map[string]int)
	bySeverity := map[string]int{
		"critical": 0,
		"high":     0,
		"medium":   0,
		"low":      0,
		"unknown":  0,
	}
	recentCutoff := time.Now().Add(-24 * time.Hour)
	recent24h := 0

	for _, c := range cveStore.cves {
		bySource[c.Source]++
		sev := c.Severity
		if _, ok := bySeverity[sev]; ok {
			bySeverity[sev]++
		} else {
			bySeverity["unknown"]++
		}
		if t, err := time.Parse("2006-01-02", c.DateAdded); err == nil && t.After(recentCutoff) {
			recent24h++
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"total":      len(cveStore.cves),
		"bySeverity": bySeverity,
		"bySource":   bySource,
		"recent24h":  recent24h,
	})
}

// POST /api/cve/agent-scan — trigger an agent-assisted CVE scan against current scope
// The actual scanning logic is handled by the agent orchestrator; this endpoint
// initiates the workflow and returns an acknowledgment.
func handleCVEAgentScan(w http.ResponseWriter, r *http.Request) {
	var body struct {
		AgentID  string `json:"agentId"`
		Severity string `json:"severity"` // filter: critical, high, etc.
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid body"})
		return
	}

	// Run scope matching synchronously to provide immediate results
	scopeMu.RLock()
	assets := make([]ScopeAsset, len(scopeAssets))
	copy(assets, scopeAssets)
	scopeMu.RUnlock()

	cveStore.RLock()
	allCVEs := make([]EnrichedCVE, len(cveStore.cves))
	copy(allCVEs, cveStore.cves)
	cveStore.RUnlock()

	// Apply severity filter if requested
	if body.Severity != "" {
		allCVEs = filterCVEs(allCVEs, body.Severity, "", "", "")
	}

	matches := make([]CVEMatch, 0)
	for _, asset := range assets {
		patternLow := strings.ToLower(strings.TrimPrefix(asset.Pattern, "*."))
		for _, cve := range allCVEs {
			vendorLow := strings.ToLower(cve.VendorProject + " " + cve.Product)
			if strings.Contains(vendorLow, patternLow) || strings.Contains(patternLow, vendorLow) {
				matches = append(matches, CVEMatch{
					CVE:    cve,
					Target: asset.Pattern,
					Reason: fmt.Sprintf("agent-scan: vendor/product match against scope %q", asset.Pattern),
				})
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"scanId":  fmt.Sprintf("cve-scan-%d", time.Now().UnixMilli()),
		"matches": matches,
		"count":   len(matches),
	})
}

// POST /api/cve/auto-triage — classify and prioritize CVE matches using rule-based scoring.
// Scores based on: CVSS score, known ransomware use, exploit availability, scope coverage.
func handleCVEAutoTriage(w http.ResponseWriter, r *http.Request) {
	cveStore.RLock()
	matches := make([]CVEMatch, len(cveStore.matches))
	copy(matches, cveStore.matches)
	cveStore.RUnlock()

	if len(matches) == 0 {
		// Run a fresh match if nothing cached
		scopeMu.RLock()
		assets := make([]ScopeAsset, len(scopeAssets))
		copy(assets, scopeAssets)
		scopeMu.RUnlock()

		cveStore.RLock()
		allCVEs := make([]EnrichedCVE, len(cveStore.cves))
		copy(allCVEs, cveStore.cves)
		cveStore.RUnlock()

		for _, asset := range assets {
			patternLow := strings.ToLower(strings.TrimPrefix(asset.Pattern, "*."))
			for _, cve := range allCVEs {
				haystack := strings.ToLower(cve.VendorProject + " " + cve.Product)
				if strings.Contains(haystack, patternLow) {
					matches = append(matches, CVEMatch{
						CVE:    cve,
						Target: asset.Pattern,
						Reason: "auto-triage scope match",
					})
				}
			}
		}
	}

	type TriageResult struct {
		CVEMatch
		Priority string  `json:"priority"` // P0–P3
		Score    float64 `json:"triageScore"`
	}

	results := make([]TriageResult, 0, len(matches))
	for _, m := range matches {
		score := m.CVE.CVSSScore
		if m.CVE.ExploitAvailable {
			score += 2.0
		}
		if strings.Contains(strings.ToLower(m.CVE.KnownRansomware), "known") {
			score += 1.5
		}

		var priority string
		switch {
		case score >= 10:
			priority = "P0"
		case score >= 8:
			priority = "P1"
		case score >= 5:
			priority = "P2"
		default:
			priority = "P3"
		}

		results = append(results, TriageResult{
			CVEMatch: m,
			Priority: priority,
			Score:    score,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"results": results,
		"count":   len(results),
	})
}
