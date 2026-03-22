package neo4jclient

import (
	"context"
	"fmt"
	"strings"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// ---- Label and relationship-type constants ----
// Using typed constants prevents typos in Cypher templates and allows grep-based
// refactoring of the entire schema without touching individual query strings.

const (
	// Node labels
	LabelHost          = "Host"
	LabelService       = "Service"
	LabelVulnerability = "Vulnerability"
	LabelTechnique     = "Technique"
	LabelMission       = "Mission"
	LabelAgent         = "Agent"
	LabelCredential    = "Credential"
	LabelFinding       = "Finding"
	LabelTarget        = "Target"
	LabelSubdomain     = "Subdomain"

	// Relationship types
	RelHasService     = "HAS_SERVICE"
	RelHasVuln        = "HAS_VULN"
	RelFoundBy        = "FOUND_BY"
	RelTargeted       = "TARGETED"
	RelPerformed      = "PERFORMED"
	RelHasCredential  = "HAS_CREDENTIAL"
	RelHasFinding     = "HAS_FINDING"
	RelSubdomainOf    = "SUBDOMAIN_OF"
	RelAffectedByCVE  = "AFFECTED_BY_CVE"
)

// ---- Input types for bulk operations ----

// NodeInput describes a single node to be created or merged.
type NodeInput struct {
	Label      string         `json:"label"`
	UniqueKey  string         `json:"unique_key"`
	Properties map[string]any `json:"properties"`
}

// RelInput describes a directed relationship between two nodes.
type RelInput struct {
	FromLabel  string         `json:"from_label"`
	FromKey    string         `json:"from_key"`
	FromVal    any            `json:"from_val"`
	RelType    string         `json:"rel_type"`
	ToLabel    string         `json:"to_label"`
	ToKey      string         `json:"to_key"`
	ToVal      any            `json:"to_val"`
	Properties map[string]any `json:"properties"`
}

// ---- Query helpers ----

// nodeToMap converts a neo4j.Node into a plain map[string]any that is safe to
// JSON-encode. The special keys "_id", "_labels", and "_element_id" are
// injected alongside the node's own properties.
func nodeToMap(node neo4j.Node) map[string]any {
	m := make(map[string]any, len(node.Props)+3)
	for k, v := range node.Props {
		m[k] = v
	}
	m["_id"] = node.Id
	m["_element_id"] = node.ElementId
	m["_labels"] = node.Labels
	return m
}

// relToMap converts a neo4j.Relationship into a plain map[string]any.
func relToMap(rel neo4j.Relationship) map[string]any {
	m := make(map[string]any, len(rel.Props)+4)
	for k, v := range rel.Props {
		m[k] = v
	}
	m["_id"] = rel.Id
	m["_element_id"] = rel.ElementId
	m["_type"] = rel.Type
	m["_start_id"] = rel.StartId
	m["_end_id"] = rel.EndId
	return m
}

// ---- CRUD functions ----

// CreateNode merges a node of the given label using uniqueKey as the MERGE
// predicate, then sets all provided props plus an updated_at timestamp.
// The full merged node is returned as a property map.
func CreateNode(
	ctx context.Context,
	c *Client,
	label string,
	uniqueKey string,
	uniqueVal any,
	props map[string]any,
) (map[string]any, error) {
	cypher := fmt.Sprintf(`
MERGE (n:%s {%s: $uniqueVal})
SET n += $props, n.updated_at = datetime()
RETURN n`, label, uniqueKey)

	result, err := c.Write(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		rec, err := tx.Run(ctx, cypher, map[string]any{
			"uniqueVal": uniqueVal,
			"props":     props,
		})
		if err != nil {
			return nil, err
		}
		if rec.Next(ctx) {
			node, ok := rec.Record().Values[0].(neo4j.Node)
			if !ok {
				return nil, fmt.Errorf("unexpected value type for node")
			}
			return nodeToMap(node), nil
		}
		return nil, rec.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("neo4jclient: CreateNode (%s): %w", label, err)
	}
	if result == nil {
		return nil, fmt.Errorf("neo4jclient: CreateNode (%s): no record returned", label)
	}
	return result.(map[string]any), nil
}

// GetNode retrieves a single node by label and a key/value pair. Returns nil
// without an error when the node does not exist.
func GetNode(
	ctx context.Context,
	c *Client,
	label, key string,
	val any,
) (map[string]any, error) {
	cypher := fmt.Sprintf(`MATCH (n:%s {%s: $val}) RETURN n LIMIT 1`, label, key)

	result, err := c.Read(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		rec, err := tx.Run(ctx, cypher, map[string]any{"val": val})
		if err != nil {
			return nil, err
		}
		if rec.Next(ctx) {
			node, ok := rec.Record().Values[0].(neo4j.Node)
			if !ok {
				return nil, fmt.Errorf("unexpected value type for node")
			}
			return nodeToMap(node), nil
		}
		if err := rec.Err(); err != nil {
			return nil, err
		}
		return nil, nil // not found — caller checks nil
	})
	if err != nil {
		return nil, fmt.Errorf("neo4jclient: GetNode (%s): %w", label, err)
	}
	if result == nil {
		return nil, nil
	}
	return result.(map[string]any), nil
}

// ListNodes returns a paginated slice of nodes for the given label. limit and
// offset follow standard SQL semantics. Use limit=0 to return all nodes (not
// recommended for large graphs).
func ListNodes(
	ctx context.Context,
	c *Client,
	label string,
	limit, offset int,
) ([]map[string]any, error) {
	cypher := fmt.Sprintf(`MATCH (n:%s) RETURN n ORDER BY n.updated_at DESC SKIP $offset LIMIT $limit`, label)
	if limit <= 0 {
		cypher = fmt.Sprintf(`MATCH (n:%s) RETURN n ORDER BY n.updated_at DESC SKIP $offset`, label)
	}

	result, err := c.Read(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		params := map[string]any{"offset": offset, "limit": limit}
		rec, err := tx.Run(ctx, cypher, params)
		if err != nil {
			return nil, err
		}
		var nodes []map[string]any
		for rec.Next(ctx) {
			node, ok := rec.Record().Values[0].(neo4j.Node)
			if !ok {
				continue
			}
			nodes = append(nodes, nodeToMap(node))
		}
		return nodes, rec.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("neo4jclient: ListNodes (%s): %w", label, err)
	}
	if result == nil {
		return []map[string]any{}, nil
	}
	nodes, ok := result.([]map[string]any)
	if !ok {
		return []map[string]any{}, nil
	}
	return nodes, nil
}

// DeleteNode performs a DETACH DELETE on the first node matching the label and
// key/value pair. DETACH DELETE removes all relationships connected to the node
// before deleting it, preventing orphaned relationship errors.
func DeleteNode(
	ctx context.Context,
	c *Client,
	label, key string,
	val any,
) error {
	cypher := fmt.Sprintf(`MATCH (n:%s {%s: $val}) DETACH DELETE n`, label, key)

	_, err := c.Write(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		_, err := tx.Run(ctx, cypher, map[string]any{"val": val})
		return nil, err
	})
	if err != nil {
		return fmt.Errorf("neo4jclient: DeleteNode (%s): %w", label, err)
	}
	return nil
}

// CreateRelation merges a directed relationship of relType between two nodes
// identified by their label+key+value triplets. props are applied to the
// relationship via SET. An updated_at timestamp is always set on the
// relationship.
func CreateRelation(
	ctx context.Context,
	c *Client,
	fromLabel, fromKey string, fromVal any,
	relType string,
	toLabel, toKey string, toVal any,
	props map[string]any,
) error {
	cypher := fmt.Sprintf(`
MATCH (a:%s {%s: $fromVal})
MATCH (b:%s {%s: $toVal})
MERGE (a)-[r:%s]->(b)
SET r += $props, r.updated_at = datetime()`,
		fromLabel, fromKey, toLabel, toKey, relType)

	_, err := c.Write(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		_, err := tx.Run(ctx, cypher, map[string]any{
			"fromVal": fromVal,
			"toVal":   toVal,
			"props":   props,
		})
		return nil, err
	})
	if err != nil {
		return fmt.Errorf("neo4jclient: CreateRelation (%s)-[%s]->(%s): %w",
			fromLabel, relType, toLabel, err)
	}
	return nil
}

// GetNeighbors traverses up to depth hops from the anchor node in both
// directions and returns all distinct nodes and relationships on those paths.
// depth is clamped to a maximum of 3 to prevent accidental full-graph scans.
func GetNeighbors(
	ctx context.Context,
	c *Client,
	label, key string,
	val any,
	depth int,
) (nodes []map[string]any, rels []map[string]any, err error) {
	// Clamp depth to avoid runaway traversals on dense graphs.
	if depth < 1 {
		depth = 1
	}
	if depth > 3 {
		depth = 3
	}

	cypher := fmt.Sprintf(`
MATCH path = (n:%s {%s: $val})-[*1..%d]-(m)
WITH nodes(path) AS ns, relationships(path) AS rs
UNWIND ns AS node
WITH collect(DISTINCT node) AS allNodes, rs
UNWIND rs AS rel
RETURN allNodes, collect(DISTINCT rel) AS allRels`,
		label, key, depth)

	result, err := c.Read(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		rec, err := tx.Run(ctx, cypher, map[string]any{"val": val})
		if err != nil {
			return nil, err
		}

		type pair struct {
			nodes []map[string]any
			rels  []map[string]any
		}
		var out pair

		if rec.Next(ctx) {
			record := rec.Record()

			rawNodes := record.Values[0]
			rawRels := record.Values[1]

			if nodeSlice, ok := rawNodes.([]any); ok {
				seen := map[int64]bool{}
				for _, n := range nodeSlice {
					if node, ok := n.(neo4j.Node); ok && !seen[node.Id] {
						seen[node.Id] = true
						out.nodes = append(out.nodes, nodeToMap(node))
					}
				}
			}
			if relSlice, ok := rawRels.([]any); ok {
				seen := map[int64]bool{}
				for _, r := range relSlice {
					if rel, ok := r.(neo4j.Relationship); ok && !seen[rel.Id] {
						seen[rel.Id] = true
						out.rels = append(out.rels, relToMap(rel))
					}
				}
			}
		}
		return out, rec.Err()
	})
	if err != nil {
		return nil, nil, fmt.Errorf("neo4jclient: GetNeighbors (%s): %w", label, err)
	}

	type pair struct {
		nodes []map[string]any
		rels  []map[string]any
	}
	if out, ok := result.(pair); ok {
		return out.nodes, out.rels, nil
	}
	return []map[string]any{}, []map[string]any{}, nil
}

// SearchNodes performs a case-insensitive substring match on the most common
// human-readable properties (name, hostname, ip, title) for the given label.
// An empty label searches across all labels. Results are capped at limit.
func SearchNodes(
	ctx context.Context,
	c *Client,
	query string,
	label string,
	limit int,
) ([]map[string]any, error) {
	if limit <= 0 {
		limit = 50
	}

	// Build the label filter — omit it entirely for cross-label search.
	labelFilter := ""
	if label != "" {
		labelFilter = ":" + label
	}

	// toLower()+CONTAINS is more portable than the APOC or full-text index
	// options, which may not be available in all Neo4j editions. Performance
	// is acceptable for graph sizes typical of individual pentests.
	lq := strings.ToLower(query)
	cypher := fmt.Sprintf(`
MATCH (n%s)
WHERE toLower(coalesce(n.name, ''))     CONTAINS $q
   OR toLower(coalesce(n.hostname, '')) CONTAINS $q
   OR toLower(coalesce(n.ip, ''))       CONTAINS $q
   OR toLower(coalesce(n.title, ''))    CONTAINS $q
RETURN n LIMIT $limit`, labelFilter)

	result, err := c.Read(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		rec, err := tx.Run(ctx, cypher, map[string]any{"q": lq, "limit": limit})
		if err != nil {
			return nil, err
		}
		var out []map[string]any
		for rec.Next(ctx) {
			node, ok := rec.Record().Values[0].(neo4j.Node)
			if !ok {
				continue
			}
			out = append(out, nodeToMap(node))
		}
		return out, rec.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("neo4jclient: SearchNodes: %w", err)
	}
	if result == nil {
		return []map[string]any{}, nil
	}
	out, ok := result.([]map[string]any)
	if !ok {
		return []map[string]any{}, nil
	}
	return out, nil
}

// GetAttackPath returns all nodes and relationships reachable from the Mission
// node identified by missionID, up to 5 hops. This gives a complete picture
// of the attack chain recorded for a given operation without pulling the full
// graph.
func GetAttackPath(
	ctx context.Context,
	c *Client,
	missionID string,
) ([]map[string]any, error) {
	cypher := `
MATCH path = (m:Mission {id: $id})-[*1..5]-(n)
WITH nodes(path) AS ns, relationships(path) AS rs
UNWIND ns AS node
WITH collect(DISTINCT node) AS allNodes, rs
UNWIND rs AS rel
RETURN allNodes, collect(DISTINCT rel) AS allRels`

	result, err := c.Read(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		rec, err := tx.Run(ctx, cypher, map[string]any{"id": missionID})
		if err != nil {
			return nil, err
		}

		var out []map[string]any
		if rec.Next(ctx) {
			record := rec.Record()

			// Pack both nodes and rels into the output slice with a type discriminator
			// so the caller can distinguish them. Index 0 = nodes, index 1 = rels.
			rawNodes := record.Values[0]
			rawRels := record.Values[1]

			if nodeSlice, ok := rawNodes.([]any); ok {
				for _, n := range nodeSlice {
					if node, ok := n.(neo4j.Node); ok {
						m := nodeToMap(node)
						m["_kind"] = "node"
						out = append(out, m)
					}
				}
			}
			if relSlice, ok := rawRels.([]any); ok {
				for _, r := range relSlice {
					if rel, ok := r.(neo4j.Relationship); ok {
						m := relToMap(rel)
						m["_kind"] = "relationship"
						out = append(out, m)
					}
				}
			}
		}
		return out, rec.Err()
	})
	if err != nil {
		return nil, fmt.Errorf("neo4jclient: GetAttackPath (mission %s): %w", missionID, err)
	}
	if result == nil {
		return []map[string]any{}, nil
	}
	out, ok := result.([]map[string]any)
	if !ok {
		return []map[string]any{}, nil
	}
	return out, nil
}

// GetStats returns the node count per label and the relationship count per
// type. This is used by the Knowledge Graph dashboard panel to render the
// summary tiles without pulling actual graph data.
func GetStats(ctx context.Context, c *Client) (map[string]any, error) {
	labels := []string{
		LabelHost, LabelService, LabelVulnerability, LabelTechnique,
		LabelMission, LabelAgent, LabelCredential, LabelFinding,
		LabelTarget, LabelSubdomain,
	}
	relTypes := []string{
		RelHasService, RelHasVuln, RelFoundBy, RelTargeted, RelPerformed,
		RelHasCredential, RelHasFinding, RelSubdomainOf, RelAffectedByCVE,
	}

	result, err := c.Read(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		stats := map[string]any{
			"nodes":         map[string]any{},
			"relationships": map[string]any{},
		}

		// Count nodes per label.
		for _, lbl := range labels {
			cypher := fmt.Sprintf(`MATCH (n:%s) RETURN count(n) AS cnt`, lbl)
			rec, err := tx.Run(ctx, cypher, nil)
			if err != nil {
				return nil, err
			}
			if rec.Next(ctx) {
				cnt, _ := rec.Record().Get("cnt")
				stats["nodes"].(map[string]any)[lbl] = cnt
			}
		}

		// Count relationships per type.
		for _, rt := range relTypes {
			cypher := fmt.Sprintf(`MATCH ()-[r:%s]->() RETURN count(r) AS cnt`, rt)
			rec, err := tx.Run(ctx, cypher, nil)
			if err != nil {
				return nil, err
			}
			if rec.Next(ctx) {
				cnt, _ := rec.Record().Get("cnt")
				stats["relationships"].(map[string]any)[rt] = cnt
			}
		}

		return stats, nil
	})
	if err != nil {
		return nil, fmt.Errorf("neo4jclient: GetStats: %w", err)
	}
	if result == nil {
		return map[string]any{}, nil
	}
	return result.(map[string]any), nil
}

// BulkIngest creates or merges all provided nodes and relationships inside a
// single write transaction. This is more efficient than calling CreateNode and
// CreateRelation individually for large scan result ingestion because it avoids
// the overhead of opening a new transaction per operation.
//
// If any node or relationship fails, the entire batch is rolled back.
func BulkIngest(ctx context.Context, c *Client, nodes []NodeInput, rels []RelInput) error {
	_, err := c.Write(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		// Ingest nodes first so relationship endpoints are guaranteed to exist.
		for i, n := range nodes {
			if n.Label == "" || n.UniqueKey == "" {
				return nil, fmt.Errorf("node[%d]: label and unique_key are required", i)
			}
			uniqueVal, ok := n.Properties[n.UniqueKey]
			if !ok {
				return nil, fmt.Errorf("node[%d]: unique_key %q not found in properties", i, n.UniqueKey)
			}
			cypher := fmt.Sprintf(`
MERGE (n:%s {%s: $uniqueVal})
SET n += $props, n.updated_at = datetime()`, n.Label, n.UniqueKey)

			if _, err := tx.Run(ctx, cypher, map[string]any{
				"uniqueVal": uniqueVal,
				"props":     n.Properties,
			}); err != nil {
				return nil, fmt.Errorf("node[%d] (%s): %w", i, n.Label, err)
			}
		}

		// Ingest relationships after all nodes are merged.
		for i, r := range rels {
			if r.RelType == "" {
				return nil, fmt.Errorf("rel[%d]: rel_type is required", i)
			}
			cypher := fmt.Sprintf(`
MATCH (a:%s {%s: $fromVal})
MATCH (b:%s {%s: $toVal})
MERGE (a)-[r:%s]->(b)
SET r += $props, r.updated_at = datetime()`,
				r.FromLabel, r.FromKey, r.ToLabel, r.ToKey, r.RelType)

			if _, err := tx.Run(ctx, cypher, map[string]any{
				"fromVal": r.FromVal,
				"toVal":   r.ToVal,
				"props":   r.Properties,
			}); err != nil {
				return nil, fmt.Errorf("rel[%d] (%s)-[%s]->(%s): %w",
					i, r.FromLabel, r.RelType, r.ToLabel, err)
			}
		}

		return nil, nil
	})
	if err != nil {
		return fmt.Errorf("neo4jclient: BulkIngest: %w", err)
	}
	return nil
}
