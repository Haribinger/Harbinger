const http = require("http");

const PORT = parseInt(process.env.MCP_UI_PORT || "3003", 10);
const SERVICE_NAME = "mcp-ui";
const startedAt = new Date().toISOString();
const HARBINGER_API = process.env.HARBINGER_API_URL || "http://backend:8080";
const REDIS_URL = process.env.REDIS_URL || "";

// Visualization widgets available to the dashboard
const WIDGETS = [
  { id: "attack_graph", name: "Attack Graph", category: "Visualization", description: "Interactive attack path visualization using Neo4j data" },
  { id: "scan_timeline", name: "Scan Timeline", category: "Visualization", description: "Chronological view of all scan activities" },
  { id: "vuln_heatmap", name: "Vulnerability Heatmap", category: "Visualization", description: "Severity-based heatmap of discovered vulnerabilities" },
  { id: "agent_network", name: "Agent Network", category: "Monitoring", description: "Real-time agent communication and task flow graph" },
  { id: "port_matrix", name: "Port Matrix", category: "Visualization", description: "Target-vs-port matrix from scan results" },
  { id: "finding_treemap", name: "Finding Treemap", category: "Visualization", description: "Hierarchical treemap of findings by category and severity" },
  { id: "service_health", name: "Service Health Grid", category: "Monitoring", description: "Grid view of all Harbinger service statuses" },
  { id: "traffic_flow", name: "Traffic Flow", category: "Monitoring", description: "Sankey diagram of network traffic through proxy" },
  { id: "credential_map", name: "Credential Map", category: "Visualization", description: "Relationship map of discovered credentials and access paths" },
  { id: "timeline_gantt", name: "Operation Gantt", category: "Monitoring", description: "Gantt chart of ongoing red team operations" },
];

// In-memory dashboard configs
const dashboards = new Map();

function json(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  if (url === "/health" || url === "/healthz") {
    return json(res, 200, {
      status: "ok",
      service: SERVICE_NAME,
      version: "1.0.0",
      uptime: process.uptime(),
      started_at: startedAt,
      widgets_count: WIDGETS.length,
      dashboards_count: dashboards.size,
    });
  }

  if (url === "/api/v1/info") {
    return json(res, 200, {
      name: "MCP-UI Visualization Server",
      description: "Dashboard and visualization engine — attack graphs, scan timelines, vulnerability heatmaps.",
      version: "1.0.0",
      widgets_count: WIDGETS.length,
      categories: [...new Set(WIDGETS.map((w) => w.category))],
      status: "ready",
    });
  }

  // Widget inventory (matches the /api/v1/tools shape for MCP consistency)
  if (url === "/api/v1/tools" || url === "/api/v1/widgets") {
    return json(res, 200, { tools: WIDGETS });
  }

  // Single widget lookup
  if (url.startsWith("/api/v1/tools/") || url.startsWith("/api/v1/widgets/")) {
    const widgetId = url.replace(/^\/api\/v1\/(tools|widgets)\//, "");
    const widget = WIDGETS.find((w) => w.id === widgetId);
    if (widget) return json(res, 200, widget);
    return json(res, 404, { error: `widget '${widgetId}' not found` });
  }

  // Category listing
  if (url === "/api/v1/categories") {
    const categories = {};
    WIDGETS.forEach((w) => {
      if (!categories[w.category]) categories[w.category] = [];
      categories[w.category].push(w.id);
    });
    return json(res, 200, { categories });
  }

  // Dashboard CRUD
  if (req.method === "POST" && url === "/api/v1/dashboards") {
    try {
      const body = await parseBody(req);
      const id = `dash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const dashboard = {
        id,
        name: body.name || "Unnamed Dashboard",
        widgets: body.widgets || [],
        layout: body.layout || "grid",
        created_at: new Date().toISOString(),
      };
      dashboards.set(id, dashboard);
      return json(res, 201, { ok: true, dashboard });
    } catch (err) {
      return json(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === "GET" && url === "/api/v1/dashboards") {
    return json(res, 200, { dashboards: Array.from(dashboards.values()) });
  }

  // Root page — minimal status UI instead of "coming soon"
  if (url === "/") {
    const html = `<!DOCTYPE html>
<html><head><title>MCP-UI</title><style>
  body { background: #0a0a0f; color: #f0c040; font-family: 'JetBrains Mono', monospace; padding: 40px; }
  h1 { font-size: 18px; letter-spacing: 0.2em; }
  .stat { color: #9ca3af; font-size: 13px; margin: 8px 0; }
  .val { color: #22c55e; }
</style></head><body>
  <h1>HARBINGER MCP-UI</h1>
  <div class="stat">STATUS: <span class="val">READY</span></div>
  <div class="stat">WIDGETS: <span class="val">${WIDGETS.length}</span></div>
  <div class="stat">DASHBOARDS: <span class="val">${dashboards.size}</span></div>
  <div class="stat">UPTIME: <span class="val">${Math.floor(process.uptime())}s</span></div>
</body></html>`;
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(html);
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[${SERVICE_NAME}] MCP server listening on port ${PORT} — ${WIDGETS.length} widgets registered`);
});
