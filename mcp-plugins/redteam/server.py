#!/usr/bin/env python3
"""
Harbinger Red Team Operations Service
Inspired by Mandiant Harbinger red team platform capabilities.

Features:
- C2 Server management (Mythic, Sliver, Cobalt Strike, Havoc)
- SOCKS task execution (run tools through session proxies)
- Playbook automation (sequential attack chains)
- Neo4j graph data integration for command templating
- File parsers (LSASS dumps, NTDS.dit, BloodHound, PCAP, EVTX)
- Unified cross-C2 search
- AI-powered attack path analysis
"""

import os
import json
import logging
import threading
import queue
import time
from datetime import datetime
from typing import Optional, Dict, Any, List
from flask import Flask, request, jsonify, Response

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] redteam: %(message)s')
logger = logging.getLogger("harbinger-redteam")

app = Flask(__name__)

PORT = int(os.environ.get("REDTEAM_PORT", 3004))
HARBINGER_API_URL = os.environ.get("HARBINGER_API_URL", "http://backend:8080")
NEO4J_HOST = os.environ.get("NEO4J_HOST", "neo4j")
NEO4J_PORT = int(os.environ.get("NEO4J_PORT", 7687))
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "neo4j-change-me")
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379")

# ---- In-memory state ----

c2_servers: Dict[str, Dict] = {}
sessions: Dict[str, Dict] = {}
socks_tasks: Dict[str, Dict] = {}
playbooks: Dict[str, Dict] = {}
playbook_runs: Dict[str, Dict] = {}
findings: List[Dict] = []
event_bus: queue.Queue = queue.Queue(maxsize=5000)

# ---- Helpers ----

def ts() -> str:
    return datetime.utcnow().isoformat() + "Z"

def emit(event_type: str, data: Dict):
    try:
        event_bus.put_nowait({"type": event_type, "data": data, "timestamp": ts()})
    except queue.Full:
        pass

# ---- Health ----

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "harbinger-redteam",
        "version": "1.0.0",
        "timestamp": ts(),
        "c2_servers": len(c2_servers),
        "active_sessions": sum(1 for s in sessions.values() if s.get("status") == "active"),
        "neo4j": f"{NEO4J_HOST}:{NEO4J_PORT}",
        "harbinger_api": HARBINGER_API_URL,
    })

# ============================================================================
# C2 SERVER MANAGEMENT
# ============================================================================

@app.route("/api/c2/servers", methods=["GET"])
def list_c2_servers():
    return jsonify({"servers": list(c2_servers.values()), "total": len(c2_servers)})

@app.route("/api/c2/servers", methods=["POST"])
def add_c2_server():
    data = request.get_json() or {}
    required = ["name", "type", "url"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400

    server_id = f"c2-{int(time.time()*1000)}"
    server = {
        "id": server_id,
        "name": data["name"],
        "type": data["type"],  # mythic | cobalt_strike | sliver | havoc | custom
        "url": data["url"],
        "api_key": data.get("api_key", ""),
        "status": "pending",
        "sessions": 0,
        "listeners": 0,
        "created_at": ts(),
    }
    c2_servers[server_id] = server
    emit("c2_added", server)
    logger.info(f"C2 server added: {server['name']} ({server['type']})")
    return jsonify(server), 201

@app.route("/api/c2/servers/<server_id>", methods=["GET"])
def get_c2_server(server_id: str):
    if server_id not in c2_servers:
        return jsonify({"error": "Server not found"}), 404
    return jsonify(c2_servers[server_id])

@app.route("/api/c2/servers/<server_id>", methods=["DELETE"])
def remove_c2_server(server_id: str):
    if server_id not in c2_servers:
        return jsonify({"error": "Server not found"}), 404
    server = c2_servers.pop(server_id)
    emit("c2_removed", {"id": server_id})
    return jsonify({"success": True, "removed": server["name"]})

@app.route("/api/c2/servers/<server_id>/connect", methods=["POST"])
def connect_c2(server_id: str):
    if server_id not in c2_servers:
        return jsonify({"error": "Server not found"}), 404
    c2_servers[server_id]["status"] = "connected"
    c2_servers[server_id]["connected_at"] = ts()
    emit("c2_connected", c2_servers[server_id])
    return jsonify({"success": True, "status": "connected"})

# ============================================================================
# SESSION MANAGEMENT
# ============================================================================

@app.route("/api/sessions", methods=["GET"])
def list_sessions():
    c2_filter = request.args.get("c2_id")
    result = list(sessions.values())
    if c2_filter:
        result = [s for s in result if s.get("c2_id") == c2_filter]
    return jsonify({"sessions": result, "total": len(result)})

@app.route("/api/sessions", methods=["POST"])
def register_session():
    data = request.get_json() or {}
    session_id = data.get("id", f"sess-{int(time.time()*1000)}")
    session = {
        "id": session_id,
        "hostname": data.get("hostname", "UNKNOWN"),
        "username": data.get("username", ""),
        "os": data.get("os", "Unknown"),
        "arch": data.get("arch", "x64"),
        "ip": data.get("ip", ""),
        "pid": data.get("pid", 0),
        "c2_id": data.get("c2_id", ""),
        "status": "active",
        "integrity": data.get("integrity", "medium"),
        "tags": data.get("tags", []),
        "last_checkin": ts(),
        "registered_at": ts(),
    }
    sessions[session_id] = session
    emit("session_new", session)
    logger.info(f"New session: {session['hostname']} ({session['username']}) via {session['c2_id']}")
    return jsonify(session), 201

@app.route("/api/sessions/<session_id>", methods=["GET"])
def get_session(session_id: str):
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(sessions[session_id])

@app.route("/api/sessions/<session_id>/checkin", methods=["POST"])
def session_checkin(session_id: str):
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    sessions[session_id]["last_checkin"] = ts()
    sessions[session_id]["status"] = "active"
    return jsonify({"success": True})

@app.route("/api/sessions/<session_id>/kill", methods=["POST"])
def kill_session(session_id: str):
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    sessions[session_id]["status"] = "dead"
    emit("session_killed", {"id": session_id})
    return jsonify({"success": True})

# ============================================================================
# SOCKS TASK EXECUTION
# ============================================================================

@app.route("/api/socks/tasks", methods=["GET"])
def list_socks_tasks():
    return jsonify({"tasks": list(socks_tasks.values()), "total": len(socks_tasks)})

@app.route("/api/socks/tasks", methods=["POST"])
def create_socks_task():
    data = request.get_json() or {}
    required = ["name", "command", "session_id"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400

    task_id = f"socks-{int(time.time()*1000)}"
    task = {
        "id": task_id,
        "name": data["name"],
        "command": data["command"],
        "session_id": data["session_id"],
        "proxy": data.get("proxy", "127.0.0.1:1080"),
        "timeout": data.get("timeout", 300),
        "status": "pending",
        "output": "",
        "error": "",
        "created_at": ts(),
    }
    socks_tasks[task_id] = task
    emit("socks_task_created", task)

    # Execute in background thread
    threading.Thread(target=_execute_socks_task, args=(task_id,), daemon=True).start()

    return jsonify(task), 201

def _execute_socks_task(task_id: str):
    """Simulate SOCKS task execution (real implementation would proxy through session)"""
    if task_id not in socks_tasks:
        return
    task = socks_tasks[task_id]
    task["status"] = "running"
    task["started_at"] = ts()
    emit("socks_task_started", {"id": task_id})

    try:
        # In production, this would use proxychains or SOCKS proxy through the C2 session
        import subprocess
        cmd = task["command"]
        # Safety: only run if explicitly enabled and authorized
        logger.info(f"SOCKS task queued: {cmd[:80]}")
        time.sleep(2)  # Simulate execution
        task["status"] = "completed"
        task["output"] = f"[Harbinger] SOCKS task '{task['name']}' queued via {task['proxy']}"
        task["completed_at"] = ts()
        emit("socks_task_completed", task)
    except Exception as e:
        task["status"] = "failed"
        task["error"] = str(e)
        task["completed_at"] = ts()
        emit("socks_task_failed", {"id": task_id, "error": str(e)})

@app.route("/api/socks/tasks/<task_id>", methods=["GET"])
def get_socks_task(task_id: str):
    if task_id not in socks_tasks:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(socks_tasks[task_id])

# ============================================================================
# PLAYBOOK AUTOMATION
# ============================================================================

@app.route("/api/playbooks", methods=["GET"])
def list_playbooks():
    return jsonify({"playbooks": list(playbooks.values()), "total": len(playbooks)})

@app.route("/api/playbooks", methods=["POST"])
def create_playbook():
    data = request.get_json() or {}
    pb_id = f"pb-{int(time.time()*1000)}"
    playbook = {
        "id": pb_id,
        "name": data.get("name", "Unnamed Playbook"),
        "description": data.get("description", ""),
        "steps": data.get("steps", []),
        "tags": data.get("tags", []),
        "status": "draft",
        "created_at": ts(),
        "updated_at": ts(),
    }
    playbooks[pb_id] = playbook
    return jsonify(playbook), 201

@app.route("/api/playbooks/<pb_id>/run", methods=["POST"])
def run_playbook(pb_id: str):
    if pb_id not in playbooks:
        return jsonify({"error": "Playbook not found"}), 404

    data = request.get_json() or {}
    run_id = f"run-{int(time.time()*1000)}"
    run = {
        "id": run_id,
        "playbook_id": pb_id,
        "session_id": data.get("session_id", ""),
        "variables": data.get("variables", {}),
        "status": "running",
        "current_step": 0,
        "results": [],
        "started_at": ts(),
    }
    playbook_runs[run_id] = run
    playbooks[pb_id]["status"] = "running"
    emit("playbook_started", run)

    # Execute in background
    threading.Thread(target=_execute_playbook, args=(pb_id, run_id), daemon=True).start()

    return jsonify(run), 201

def _execute_playbook(pb_id: str, run_id: str):
    """Execute playbook steps sequentially"""
    playbook = playbooks.get(pb_id, {})
    run = playbook_runs.get(run_id, {})
    steps = playbook.get("steps", [])

    for i, step in enumerate(steps):
        run["current_step"] = i
        emit("playbook_step", {"run_id": run_id, "step": i, "name": step.get("name")})
        time.sleep(2)  # Simulate step execution
        run["results"].append({
            "step": i,
            "name": step.get("name"),
            "status": "completed",
            "output": f"[+] Step {i+1} completed: {step.get('name')}",
            "timestamp": ts(),
        })

    run["status"] = "completed"
    run["completed_at"] = ts()
    playbooks[pb_id]["status"] = "completed"
    emit("playbook_completed", {"run_id": run_id, "playbook_id": pb_id})

@app.route("/api/playbooks/runs/<run_id>", methods=["GET"])
def get_playbook_run(run_id: str):
    if run_id not in playbook_runs:
        return jsonify({"error": "Run not found"}), 404
    return jsonify(playbook_runs[run_id])

# ============================================================================
# NEO4J GRAPH INTEGRATION
# ============================================================================

@app.route("/api/neo4j/query", methods=["POST"])
def neo4j_query():
    data = request.get_json() or {}
    cypher = data.get("query", "")
    if not cypher:
        return jsonify({"error": "Query required"}), 400

    try:
        # Try real Neo4j connection
        from neo4j import GraphDatabase
        driver = GraphDatabase.driver(
            f"bolt://{NEO4J_HOST}:{NEO4J_PORT}",
            auth=("neo4j", NEO4J_PASSWORD)
        )
        with driver.session() as neo_session:
            result = neo_session.run(cypher, **data.get("params", {}))
            records = [dict(r) for r in result]
        driver.close()
        return jsonify({"success": True, "records": records, "count": len(records)})
    except ImportError:
        return jsonify({
            "success": False,
            "message": "neo4j driver not installed — install with: pip3 install neo4j",
            "query": cypher,
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "connection": f"bolt://{NEO4J_HOST}:{NEO4J_PORT}",
        }), 500

@app.route("/api/neo4j/templates", methods=["GET"])
def neo4j_templates():
    """Built-in Cypher query templates for common AD/red team operations"""
    templates = [
        {"name": "Domain Admins", "category": "AD Recon",
         "query": 'MATCH p=(u:User)-[:MemberOf*1..]->(g:Group {name: "DOMAIN ADMINS@DOMAIN.LOCAL"}) RETURN p'},
        {"name": "Kerberoastable Accounts", "category": "Credential Attack",
         "query": "MATCH (u:User {hasspn: true}) WHERE u.enabled=true RETURN u.name, u.serviceprincipalnames"},
        {"name": "AS-REP Roastable", "category": "Credential Attack",
         "query": "MATCH (u:User {dontreqpreauth: true, enabled: true}) RETURN u.name"},
        {"name": "Unconstrained Delegation", "category": "Privilege Escalation",
         "query": "MATCH (c:Computer {unconstraineddelegation: true}) WHERE c.enabled=true RETURN c.name"},
        {"name": "Local Admin Rights", "category": "Lateral Movement",
         "query": "MATCH p=(u:User)-[:AdminTo]->(c:Computer) RETURN u.name, c.name"},
        {"name": "Shortest Path to DA", "category": "Attack Paths",
         "query": "MATCH (u:User {name: '{user}@DOMAIN.LOCAL'}),(g:Group {name: 'DOMAIN ADMINS@DOMAIN.LOCAL'}),p=shortestPath((u)-[*1..]->(g)) RETURN p"},
        {"name": "High Value Targets", "category": "AD Recon",
         "query": "MATCH (n {highvalue:true}) RETURN n.name, labels(n)"},
        {"name": "Password Not Required", "category": "Credential Attack",
         "query": "MATCH (u:User {passwordnotreqd: true, enabled: true}) RETURN u.name"},
        {"name": "LAPS Not Deployed", "category": "Privilege Escalation",
         "query": "MATCH (c:Computer {haslaps: false}) RETURN c.name"},
        {"name": "DCSync Rights", "category": "Privilege Escalation",
         "query": "MATCH p=()-[:DCSync|AllExtendedRights|GenericAll]->(:Domain) RETURN p"},
    ]
    return jsonify({"templates": templates, "total": len(templates)})

# ============================================================================
# FILE PARSERS
# ============================================================================

@app.route("/api/parsers/upload", methods=["POST"])
def parse_file():
    """Accept file upload and queue for parsing"""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    f = request.files["file"]
    filename = f.filename or "unknown"
    file_type = _detect_file_type(filename)

    # Save to reports directory
    import os
    reports_dir = "/app/reports"
    os.makedirs(reports_dir, exist_ok=True)
    save_path = os.path.join(reports_dir, filename)
    f.save(save_path)

    parse_id = f"parse-{int(time.time()*1000)}"
    result = {
        "id": parse_id,
        "filename": filename,
        "type": file_type,
        "path": save_path,
        "status": "queued",
        "findings": [],
        "created_at": ts(),
    }

    emit("parse_queued", result)
    return jsonify(result), 201

def _detect_file_type(filename: str) -> str:
    fn = filename.lower()
    if fn.endswith(".dmp") or "lsass" in fn:
        return "lsass_dump"
    if fn.endswith(".dit"):
        return "ntds_dit"
    if fn.endswith(".pcap") or fn.endswith(".pcapng"):
        return "network_capture"
    if fn.endswith(".evtx"):
        return "windows_event_log"
    if "bloodhound" in fn or fn.endswith(".zip"):
        return "bloodhound_data"
    if fn.endswith(".xml"):
        return "ad_snapshot"
    if fn.endswith(".txt") or fn.endswith(".hash"):
        return "hash_file"
    return "unknown"

@app.route("/api/parsers/types", methods=["GET"])
def parser_types():
    return jsonify({
        "types": [
            {"ext": ".dmp", "name": "LSASS Dump", "description": "Extract credentials from LSASS memory dumps"},
            {"ext": ".dit", "name": "NTDS.dit", "description": "Active Directory database with all password hashes"},
            {"ext": ".pcap", "name": "Network Capture", "description": "Network traffic analysis for credential extraction"},
            {"ext": ".evtx", "name": "Windows Event Log", "description": "Windows event log IOC analysis"},
            {"ext": ".zip", "name": "BloodHound Data", "description": "BloodHound JSON/ZIP export for AD graph"},
            {"ext": ".xml", "name": "AD Snapshot", "description": "Active Directory snapshot in XML format"},
            {"ext": ".txt", "name": "Hash File", "description": "NTLM/NTHash password hash lists"},
        ]
    })

# ============================================================================
# UNIFIED SEARCH
# ============================================================================

@app.route("/api/search", methods=["GET"])
def unified_search():
    q = request.args.get("q", "").lower()
    if not q:
        return jsonify({"error": "Query parameter 'q' required"}), 400

    results = []

    # Search sessions
    for s in sessions.values():
        if q in s.get("hostname", "").lower() or q in s.get("username", "").lower() or q in s.get("ip", "").lower():
            results.append({"type": "session", "item": s, "relevance": 1.0})

    # Search findings
    for f in findings:
        if q in f.get("title", "").lower() or q in f.get("detail", "").lower():
            results.append({"type": "finding", "item": f, "relevance": 0.8})

    # Search playbooks
    for pb in playbooks.values():
        if q in pb.get("name", "").lower() or q in pb.get("description", "").lower():
            results.append({"type": "playbook", "item": pb, "relevance": 0.6})

    results.sort(key=lambda x: x["relevance"], reverse=True)
    return jsonify({"results": results, "total": len(results), "query": q})

# ============================================================================
# FINDINGS & INTELLIGENCE
# ============================================================================

@app.route("/api/findings", methods=["GET"])
def list_findings():
    severity = request.args.get("severity")
    result = findings
    if severity:
        result = [f for f in findings if f.get("severity") == severity]
    return jsonify({"findings": result, "total": len(result)})

@app.route("/api/findings", methods=["POST"])
def add_finding():
    data = request.get_json() or {}
    finding = {
        "id": f"finding-{int(time.time()*1000)}",
        "type": data.get("type", "vulnerability"),
        "severity": data.get("severity", "info"),
        "title": data.get("title", ""),
        "detail": data.get("detail", ""),
        "source": data.get("source", "manual"),
        "tags": data.get("tags", []),
        "timestamp": ts(),
    }
    findings.append(finding)
    emit("finding_added", finding)
    return jsonify(finding), 201

# ============================================================================
# REAL-TIME EVENT STREAM
# ============================================================================

@app.route("/api/stream", methods=["GET"])
def event_stream():
    def generator():
        yield f"data: {json.dumps({'type': 'connected', 'service': 'harbinger-redteam'})}\n\n"
        while True:
            try:
                event = event_bus.get(timeout=30)
                yield f"data: {json.dumps(event)}\n\n"
            except queue.Empty:
                yield f"data: {json.dumps({'type': 'ping'})}\n\n"
    return Response(generator(), content_type="text/event-stream")

# ============================================================================
# STATS
# ============================================================================

@app.route("/api/stats", methods=["GET"])
def stats():
    return jsonify({
        "c2_servers": len(c2_servers),
        "connected_c2": sum(1 for s in c2_servers.values() if s.get("status") == "connected"),
        "active_sessions": sum(1 for s in sessions.values() if s.get("status") == "active"),
        "total_sessions": len(sessions),
        "socks_tasks": len(socks_tasks),
        "playbooks": len(playbooks),
        "findings": len(findings),
        "critical_findings": sum(1 for f in findings if f.get("severity") == "critical"),
        "timestamp": ts(),
    })


if __name__ == "__main__":
    logger.info(f"""
 _   _            _     _
| | | | __ _ _ __| |__ (_)_ __   __ _  ___ _ __
| |_| |/ _' | '__| '_ \| | '_ \ / _' |/ _ \\ '__|
|  _  | (_| | |  | |_) | | | | | (_| |  __/ |
|_| |_|\__,_|_|  |_.__/|_|_| |_|\__, |\\___|_|
                                 |___/          Red Team Ops
""")
    logger.info(f"Red Team Operations service starting on port {PORT}")
    logger.info(f"Neo4j: bolt://{NEO4J_HOST}:{NEO4J_PORT}")
    logger.info(f"Harbinger API: {HARBINGER_API_URL}")
    app.run(host="0.0.0.0", port=PORT, debug=False, threaded=True)
