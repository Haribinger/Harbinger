"""
Knowledge graph client — Neo4j-backed entity/relationship store.

Schema follows the v2.0 spec:
  (:Host {ip, hostname})-[:HAS_SERVICE]->(:Service {port, protocol, product})
  (:Service)-[:HAS_VULN]->(:Vulnerability {id, severity, title, evidence})
  (:Vulnerability)-[:FOUND_BY]->(:Technique {tool, args, success})
  (:Mission)-[:TARGETED]->(:Host)
  (:Agent {codename})-[:PERFORMED {at, duration}]->(:Technique)
  (:Host)-[:HAS_CREDENTIAL]->(:Credential {username, hash, valid})

Graceful degradation: all operations return empty results when Neo4j is
unavailable, so the rest of the platform keeps running.
"""

import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# Neo4j connection — lazily initialized
_driver = None
NEO4J_URI = "bolt://neo4j:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = ""


async def _get_driver():
    """Get or create the Neo4j async driver."""
    global _driver
    if _driver is not None:
        return _driver
    try:
        from neo4j import AsyncGraphDatabase
        import os
        uri = os.getenv("NEO4J_URI", NEO4J_URI)
        user = os.getenv("NEO4J_USER", NEO4J_USER)
        password = os.getenv("NEO4J_PASSWORD", NEO4J_PASSWORD)
        _driver = AsyncGraphDatabase.driver(uri, auth=(user, password))
        return _driver
    except ImportError:
        logger.warning("neo4j package not installed — graph features disabled")
        return None
    except Exception as exc:
        logger.warning("neo4j connection failed: %s", exc)
        return None


async def close_driver():
    """Shutdown the Neo4j driver."""
    global _driver
    if _driver:
        await _driver.close()
        _driver = None


def graph_available() -> bool:
    """Check if the graph driver is initialized."""
    return _driver is not None


async def _run_query(query: str, params: dict | None = None) -> list[dict]:
    """Run a Cypher query and return records as dicts."""
    driver = await _get_driver()
    if not driver:
        return []
    try:
        async with driver.session() as session:
            result = await session.run(query, params or {})
            records = await result.data()
            return records
    except Exception as exc:
        logger.error("cypher query failed: %s — %s", query[:100], exc)
        return []


# ── Entity creation ──────────────────────────────────────────────────────────


async def store_host(ip: str, hostname: str = "", mission_id: int | None = None) -> dict:
    """Create or merge a Host node."""
    result = await _run_query(
        """
        MERGE (h:Host {ip: $ip})
        SET h.hostname = COALESCE($hostname, h.hostname),
            h.updated_at = datetime()
        RETURN h {.ip, .hostname} AS host
        """,
        {"ip": ip, "hostname": hostname},
    )
    if mission_id is not None:
        await _run_query(
            """
            MERGE (m:Mission {id: $mid})
            MERGE (h:Host {ip: $ip})
            MERGE (m)-[:TARGETED]->(h)
            """,
            {"mid": mission_id, "ip": ip},
        )
    return result[0] if result else {}


async def store_service(
    host_ip: str, port: int, protocol: str = "tcp", product: str = ""
) -> dict:
    """Create or merge a Service node linked to a Host."""
    result = await _run_query(
        """
        MERGE (h:Host {ip: $ip})
        MERGE (s:Service {host_ip: $ip, port: $port, protocol: $protocol})
        SET s.product = COALESCE($product, s.product),
            s.updated_at = datetime()
        MERGE (h)-[:HAS_SERVICE]->(s)
        RETURN s {.host_ip, .port, .protocol, .product} AS service
        """,
        {"ip": host_ip, "port": port, "protocol": protocol, "product": product},
    )
    return result[0] if result else {}


async def store_vulnerability(
    host_ip: str,
    port: int,
    vuln_id: str,
    severity: str,
    title: str,
    evidence: str = "",
) -> dict:
    """Create or merge a Vulnerability node linked to a Service."""
    result = await _run_query(
        """
        MERGE (s:Service {host_ip: $ip, port: $port})
        MERGE (v:Vulnerability {id: $vid})
        SET v.severity = $severity, v.title = $title,
            v.evidence = $evidence, v.updated_at = datetime()
        MERGE (s)-[:HAS_VULN]->(v)
        RETURN v {.id, .severity, .title} AS vuln
        """,
        {
            "ip": host_ip, "port": port, "vid": vuln_id,
            "severity": severity, "title": title, "evidence": evidence,
        },
    )
    return result[0] if result else {}


async def store_technique(
    vuln_id: str, tool: str, args: str = "", success: bool = True
) -> dict:
    """Create a Technique node linked to a Vulnerability."""
    result = await _run_query(
        """
        MERGE (v:Vulnerability {id: $vid})
        CREATE (t:Technique {tool: $tool, args: $args, success: $success, created_at: datetime()})
        MERGE (v)-[:FOUND_BY]->(t)
        RETURN t {.tool, .args, .success} AS technique
        """,
        {"vid": vuln_id, "tool": tool, "args": args, "success": success},
    )
    return result[0] if result else {}


async def store_credential(
    host_ip: str, username: str, hash_value: str = "", valid: bool = False
) -> dict:
    """Create or merge a Credential node linked to a Host."""
    result = await _run_query(
        """
        MERGE (h:Host {ip: $ip})
        MERGE (c:Credential {host_ip: $ip, username: $username})
        SET c.hash = $hash, c.valid = $valid, c.updated_at = datetime()
        MERGE (h)-[:HAS_CREDENTIAL]->(c)
        RETURN c {.username, .valid} AS credential
        """,
        {"ip": host_ip, "username": username, "hash": hash_value, "valid": valid},
    )
    return result[0] if result else {}


async def store_execution(
    agent_codename: str,
    tool_name: str,
    tool_args: str,
    result_str: str,
    duration: float,
) -> None:
    """Record an agent tool execution as Agent-[:PERFORMED]->Technique."""
    await _run_query(
        """
        MERGE (a:Agent {codename: $agent})
        CREATE (t:Technique {
            tool: $tool, args: $args, result_summary: $result,
            duration: $duration, performed_at: datetime()
        })
        CREATE (a)-[:PERFORMED {at: datetime(), duration: $duration}]->(t)
        """,
        {
            "agent": agent_codename,
            "tool": tool_name,
            "args": tool_args[:500],
            "result": result_str[:500],
            "duration": duration,
        },
    )


# ── Search queries ───────────────────────────────────────────────────────────


async def search_graph(
    query: str, search_type: str = "general", limit: int = 20
) -> list[dict]:
    """Search the knowledge graph by type.

    search_type:
      - "hosts"       → all hosts with services
      - "vulns"       → vulnerabilities with host/service context
      - "credentials" → discovered credentials
      - "techniques"  → tool executions by agents
      - "general"     → full-text search across all node properties
    """
    if search_type == "hosts":
        return await _run_query(
            """
            MATCH (h:Host)
            OPTIONAL MATCH (h)-[:HAS_SERVICE]->(s:Service)
            RETURN h.ip AS ip, h.hostname AS hostname,
                   collect(DISTINCT {port: s.port, protocol: s.protocol, product: s.product}) AS services
            ORDER BY h.ip
            LIMIT $limit
            """,
            {"limit": limit},
        )
    elif search_type == "vulns":
        return await _run_query(
            """
            MATCH (s:Service)-[:HAS_VULN]->(v:Vulnerability)
            MATCH (h:Host)-[:HAS_SERVICE]->(s)
            RETURN v.id AS vuln_id, v.severity AS severity, v.title AS title,
                   h.ip AS host, s.port AS port
            ORDER BY CASE v.severity
                WHEN 'critical' THEN 0 WHEN 'high' THEN 1
                WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END
            LIMIT $limit
            """,
            {"limit": limit},
        )
    elif search_type == "credentials":
        return await _run_query(
            """
            MATCH (h:Host)-[:HAS_CREDENTIAL]->(c:Credential)
            RETURN h.ip AS host, c.username AS username, c.valid AS valid
            LIMIT $limit
            """,
            {"limit": limit},
        )
    elif search_type == "techniques":
        return await _run_query(
            """
            MATCH (a:Agent)-[r:PERFORMED]->(t:Technique)
            RETURN a.codename AS agent, t.tool AS tool, t.args AS args,
                   t.duration AS duration, r.at AS performed_at
            ORDER BY r.at DESC
            LIMIT $limit
            """,
            {"limit": limit},
        )
    else:
        # General: full-text style search across node properties
        return await _run_query(
            """
            CALL {
                MATCH (h:Host) WHERE h.ip CONTAINS $q OR h.hostname CONTAINS $q
                RETURN 'host' AS type, h.ip AS id, h.hostname AS label
                UNION ALL
                MATCH (v:Vulnerability) WHERE v.title CONTAINS $q OR v.id CONTAINS $q
                RETURN 'vuln' AS type, v.id AS id, v.title AS label
                UNION ALL
                MATCH (c:Credential) WHERE c.username CONTAINS $q
                RETURN 'credential' AS type, c.username AS id, c.host_ip AS label
            }
            RETURN type, id, label
            LIMIT $limit
            """,
            {"q": query, "limit": limit},
        )


async def get_attack_surface(mission_id: int) -> dict:
    """Get a summary of the attack surface for a mission."""
    hosts = await _run_query(
        """
        MATCH (m:Mission {id: $mid})-[:TARGETED]->(h:Host)
        OPTIONAL MATCH (h)-[:HAS_SERVICE]->(s:Service)
        OPTIONAL MATCH (s)-[:HAS_VULN]->(v:Vulnerability)
        RETURN h.ip AS ip, h.hostname AS hostname,
               count(DISTINCT s) AS services,
               count(DISTINCT v) AS vulnerabilities
        """,
        {"mid": mission_id},
    )
    return {
        "mission_id": mission_id,
        "hosts": hosts,
        "total_hosts": len(hosts),
        "total_services": sum(h.get("services", 0) for h in hosts),
        "total_vulns": sum(h.get("vulnerabilities", 0) for h in hosts),
    }
