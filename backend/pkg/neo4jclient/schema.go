package neo4jclient

import (
	"context"
	"fmt"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// constraintDef describes a single uniqueness constraint to be created.
type constraintDef struct {
	name  string // constraint name used by Neo4j (must be unique across the DB)
	label string
	prop  string
}

// indexDef describes a single property index to be created.
type indexDef struct {
	name  string
	label string
	prop  string
}

// uniqueConstraints lists all UNIQUE constraints that must exist in the schema.
// Using IF NOT EXISTS makes every statement idempotent.
var uniqueConstraints = []constraintDef{
	{"harbinger_host_ip_unique", "Host", "ip"},
	{"harbinger_service_id_unique", "Service", "id"},
	{"harbinger_vulnerability_id_unique", "Vulnerability", "id"},
	{"harbinger_technique_id_unique", "Technique", "id"},
	{"harbinger_mission_id_unique", "Mission", "id"},
	{"harbinger_agent_codename_unique", "Agent", "codename"},
	{"harbinger_credential_id_unique", "Credential", "id"},
	{"harbinger_finding_id_unique", "Finding", "id"},
	{"harbinger_target_id_unique", "Target", "id"},
	{"harbinger_subdomain_fqdn_unique", "Subdomain", "fqdn"},
}

// propertyIndexes lists range indexes that accelerate frequently filtered
// queries without enforcing uniqueness.
var propertyIndexes = []indexDef{
	{"harbinger_host_hostname_idx", "Host", "hostname"},
	{"harbinger_vulnerability_severity_idx", "Vulnerability", "severity"},
	{"harbinger_finding_severity_idx", "Finding", "severity"},
	{"harbinger_mission_status_idx", "Mission", "status"},
	{"harbinger_agent_status_idx", "Agent", "status"},
}

// EnsureSchema applies all uniqueness constraints and property indexes to the
// database in an idempotent fashion. It is safe to call on every startup — no
// constraint or index will be recreated if it already exists.
func EnsureSchema(ctx context.Context, c *Client) error {
	session := c.Session(ctx, neo4j.AccessModeWrite)
	defer session.Close(ctx) //nolint:errcheck

	// Neo4j does not support running DDL statements inside a managed transaction
	// (they are implicitly auto-committed), so we execute them directly on the
	// session with auto-commit semantics via session.Run.
	for _, con := range uniqueConstraints {
		cypher := fmt.Sprintf(
			"CREATE CONSTRAINT %s IF NOT EXISTS FOR (n:%s) REQUIRE n.%s IS UNIQUE",
			con.name, con.label, con.prop,
		)
		if _, err := session.Run(ctx, cypher, nil); err != nil {
			return fmt.Errorf("neo4jclient: create constraint %s: %w", con.name, err)
		}
	}

	for _, idx := range propertyIndexes {
		cypher := fmt.Sprintf(
			"CREATE INDEX %s IF NOT EXISTS FOR (n:%s) ON (n.%s)",
			idx.name, idx.label, idx.prop,
		)
		if _, err := session.Run(ctx, cypher, nil); err != nil {
			return fmt.Errorf("neo4jclient: create index %s: %w", idx.name, err)
		}
	}

	return nil
}
