// Package neo4jclient provides a thin wrapper around the Neo4j Go driver,
// exposing a connection-pooled client with typed transaction helpers and
// idiomatic error messages for the Harbinger backend.
package neo4jclient

import (
	"context"
	"fmt"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// Config holds the parameters required to open a Neo4j Bolt connection pool.
type Config struct {
	// Host is the Neo4j server hostname or IP (e.g. "localhost" or "neo4j").
	Host string
	// Port is the Bolt port number as a string (e.g. "7687").
	Port string
	// Password is the neo4j user password. The username is always "neo4j".
	Password string
	// Database selects which Neo4j database to use (default: "neo4j").
	Database string
}

// boltURI builds a bolt:// URI from config.
func (c Config) boltURI() string {
	return fmt.Sprintf("bolt://%s:%s", c.Host, c.Port)
}

// database returns the configured database name, falling back to the Neo4j
// default when the field is empty.
func (c Config) database() string {
	if c.Database != "" {
		return c.Database
	}
	return "neo4j"
}

// Client wraps a neo4j.DriverWithContext and provides helper methods for
// running read/write transactions against a specific database.
type Client struct {
	driver neo4j.DriverWithContext
	cfg    Config
}

// New creates a new Client, opens a connection pool to the Neo4j instance
// described by cfg, and verifies connectivity with a round-trip ping.
// The caller must call Close when the client is no longer needed.
func New(ctx context.Context, cfg Config) (*Client, error) {
	auth := neo4j.BasicAuth("neo4j", cfg.Password, "")

	driver, err := neo4j.NewDriverWithContext(cfg.boltURI(), auth)
	if err != nil {
		return nil, fmt.Errorf("neo4jclient: open driver: %w", err)
	}

	// VerifyConnectivity performs a lightweight handshake to confirm the server
	// is reachable and the credentials are accepted before returning to the
	// caller.
	if err := driver.VerifyConnectivity(ctx); err != nil {
		_ = driver.Close(ctx)
		return nil, fmt.Errorf("neo4jclient: verify connectivity: %w", err)
	}

	return &Client{driver: driver, cfg: cfg}, nil
}

// Close gracefully shuts down all pooled connections. It must be called when
// the client is no longer needed to avoid leaking sockets.
func (c *Client) Close(ctx context.Context) error {
	if err := c.driver.Close(ctx); err != nil {
		return fmt.Errorf("neo4jclient: close driver: %w", err)
	}
	return nil
}

// Session opens a new Neo4j session with the given access mode against the
// configured database. The caller is responsible for closing the returned
// session.
func (c *Client) Session(ctx context.Context, mode neo4j.AccessMode) neo4j.SessionWithContext {
	return c.driver.NewSession(ctx, neo4j.SessionConfig{
		AccessMode:   mode,
		DatabaseName: c.cfg.database(),
	})
}

// Write executes work inside a managed write transaction. Neo4j will
// automatically retry the transaction on transient failures (e.g. leader
// election during a cluster reconfiguration). The return value of work is
// passed back to the caller unchanged.
func (c *Client) Write(ctx context.Context, work neo4j.ManagedTransactionWork) (any, error) {
	session := c.Session(ctx, neo4j.AccessModeWrite)
	defer session.Close(ctx) //nolint:errcheck — best-effort close after transaction completes

	result, err := session.ExecuteWrite(ctx, work)
	if err != nil {
		return nil, fmt.Errorf("neo4jclient: write transaction: %w", err)
	}
	return result, nil
}

// Read executes work inside a managed read transaction. Neo4j may route the
// call to a read replica in a cluster deployment, improving throughput for
// query-heavy workloads.
func (c *Client) Read(ctx context.Context, work neo4j.ManagedTransactionWork) (any, error) {
	session := c.Session(ctx, neo4j.AccessModeRead)
	defer session.Close(ctx) //nolint:errcheck — best-effort close after transaction completes

	result, err := session.ExecuteRead(ctx, work)
	if err != nil {
		return nil, fmt.Errorf("neo4jclient: read transaction: %w", err)
	}
	return result, nil
}
