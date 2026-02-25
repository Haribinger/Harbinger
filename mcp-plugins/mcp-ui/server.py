#!/usr/bin/env python3
"""
MCP-UI Visualization Server
Provides real-time visualization and dashboards for Harbinger MCP tool results.
"""

import os
import json
import logging
from datetime import datetime
from flask import Flask, request, jsonify, Response
import threading
import queue

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mcp-ui")

app = Flask(__name__)

PORT = int(os.environ.get("MCP_UI_PORT", 3003))
HARBINGER_API_URL = os.environ.get("HARBINGER_API_URL", "http://backend:8080")
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379")

# In-memory event store for SSE
event_queue = queue.Queue(maxsize=1000)
scan_results = []
active_tools = {}

# ---- Health & Status ----

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "mcp-ui",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "redis": REDIS_URL,
        "harbinger_api": HARBINGER_API_URL
    })

# ---- Real-time Dashboard ----

@app.route("/api/dashboard", methods=["GET"])
def dashboard():
    return jsonify({
        "active_tools": list(active_tools.values()),
        "recent_results": scan_results[-50:],
        "stats": {
            "total_scans": len(scan_results),
            "active_tools": len(active_tools),
            "vulnerabilities_found": sum(
                r.get("vulnerabilities", 0) for r in scan_results
            )
        },
        "timestamp": datetime.now().isoformat()
    })

# ---- Tool Results ----

@app.route("/api/results", methods=["GET"])
def get_results():
    tool = request.args.get("tool")
    limit = int(request.args.get("limit", 50))
    results = scan_results
    if tool:
        results = [r for r in results if r.get("tool") == tool]
    return jsonify({
        "results": results[-limit:],
        "total": len(results)
    })

@app.route("/api/results", methods=["POST"])
def add_result():
    data = request.get_json() or {}
    result = {
        "id": f"result-{datetime.now().timestamp():.0f}",
        "timestamp": datetime.now().isoformat(),
        **data
    }
    scan_results.append(result)
    # Limit in-memory store
    if len(scan_results) > 10000:
        scan_results.pop(0)
    # Push SSE event
    try:
        event_queue.put_nowait({"type": "result", "data": result})
    except queue.Full:
        pass
    return jsonify(result), 201

# ---- Active Tool Tracking ----

@app.route("/api/tools/active", methods=["GET"])
def get_active_tools():
    return jsonify(list(active_tools.values()))

@app.route("/api/tools/start", methods=["POST"])
def tool_started():
    data = request.get_json() or {}
    tool_id = data.get("id", f"tool-{datetime.now().timestamp():.0f}")
    active_tools[tool_id] = {
        "id": tool_id,
        "name": data.get("name", "unknown"),
        "target": data.get("target", ""),
        "started_at": datetime.now().isoformat(),
        "status": "running",
        "progress": 0
    }
    try:
        event_queue.put_nowait({"type": "tool_start", "data": active_tools[tool_id]})
    except queue.Full:
        pass
    return jsonify(active_tools[tool_id]), 201

@app.route("/api/tools/<tool_id>/stop", methods=["POST"])
def tool_stopped(tool_id):
    if tool_id in active_tools:
        active_tools[tool_id]["status"] = "completed"
        active_tools[tool_id]["completed_at"] = datetime.now().isoformat()
        try:
            event_queue.put_nowait({"type": "tool_stop", "data": active_tools[tool_id]})
        except queue.Full:
            pass
        del active_tools[tool_id]
        return jsonify({"success": True})
    return jsonify({"error": "Tool not found"}), 404

# ---- Server-Sent Events for real-time updates ----

@app.route("/api/stream", methods=["GET"])
def stream():
    def event_generator():
        # Send initial connection event
        yield f"data: {json.dumps({'type': 'connected', 'timestamp': datetime.now().isoformat()})}\n\n"
        while True:
            try:
                event = event_queue.get(timeout=30)
                yield f"data: {json.dumps(event)}\n\n"
            except queue.Empty:
                # Send heartbeat
                yield f"data: {json.dumps({'type': 'ping'})}\n\n"
    return Response(event_generator(), content_type="text/event-stream")

# ---- Visualization Plugins ----

@app.route("/api/plugins", methods=["GET"])
def list_plugins():
    plugins_dir = "/app/plugins"
    plugins = []
    if os.path.exists(plugins_dir):
        for f in os.listdir(plugins_dir):
            plugins.append({"name": f, "status": "available"})
    return jsonify({"plugins": plugins, "total": len(plugins)})


if __name__ == "__main__":
    logger.info(f"MCP-UI visualization server starting on port {PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=False, threaded=True)
