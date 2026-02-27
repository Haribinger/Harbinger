const http = require("http");

const PORT = parseInt(process.env.PENTAGI_PORT || "3002", 10);
const SERVICE_NAME = "pentagi";
const startedAt = new Date().toISOString();
const HARBINGER_API = process.env.HARBINGER_API_URL || "http://backend:8080";

// PentAGI autonomous agent capabilities — these map to the agent orchestration actions
// the frontend expects from /api/v1/tools and /api/v1/tasks endpoints.
const CAPABILITIES = [
  { id: "auto_recon", name: "Autonomous Recon", category: "Reconnaissance", description: "Run full-scope reconnaissance on a target domain" },
  { id: "exploit_chain", name: "Exploit Chain Builder", category: "Exploitation", description: "Automatically chain vulnerabilities into an attack path" },
  { id: "vuln_verify", name: "Vulnerability Verifier", category: "Verification", description: "Re-test and verify reported vulnerabilities" },
  { id: "report_gen", name: "Report Generator", category: "Reporting", description: "Generate pentest reports from findings" },
  { id: "scope_analyzer", name: "Scope Analyzer", category: "Reconnaissance", description: "Parse and validate target scope definitions" },
  { id: "credential_spray", name: "Credential Spray", category: "Exploitation", description: "Orchestrate credential spraying across discovered services" },
  { id: "lateral_move", name: "Lateral Movement", category: "Post-Exploitation", description: "Plan and execute lateral movement strategies" },
  { id: "persistence_check", name: "Persistence Checker", category: "Post-Exploitation", description: "Identify persistence mechanisms in compromised systems" },
  { id: "c2_setup", name: "C2 Setup", category: "Infrastructure", description: "Configure C2 channel for agent communication" },
  { id: "evidence_collect", name: "Evidence Collector", category: "Reporting", description: "Collect and organize evidence for findings" },
];

// In-memory task queue — persisted to Harbinger backend when available
const tasks = new Map();

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
      capabilities_count: CAPABILITIES.length,
      active_tasks: tasks.size,
    });
  }

  if (url === "/api/v1/info") {
    return json(res, 200, {
      name: "PentAGI Autonomous Agent",
      description: "Autonomous penetration testing agent system — orchestrates recon, exploitation, and reporting.",
      version: "1.0.0",
      capabilities: CAPABILITIES.map((c) => c.id),
      categories: [...new Set(CAPABILITIES.map((c) => c.category))],
      status: "ready",
    });
  }

  // Capability inventory
  if (url === "/api/v1/tools") {
    return json(res, 200, { tools: CAPABILITIES });
  }

  // Single capability lookup
  if (url.startsWith("/api/v1/tools/")) {
    const capId = url.replace("/api/v1/tools/", "");
    const cap = CAPABILITIES.find((c) => c.id === capId);
    if (cap) return json(res, 200, cap);
    return json(res, 404, { error: `capability '${capId}' not found` });
  }

  // Category listing
  if (url === "/api/v1/categories") {
    const categories = {};
    CAPABILITIES.forEach((c) => {
      if (!categories[c.category]) categories[c.category] = [];
      categories[c.category].push(c.id);
    });
    return json(res, 200, { categories });
  }

  // Create a task
  if (req.method === "POST" && url === "/api/v1/tasks") {
    try {
      const body = await parseBody(req);
      const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const task = {
        id: taskId,
        capability: body.capability || "auto_recon",
        target: body.target || "",
        status: "queued",
        created_at: new Date().toISOString(),
        result: null,
      };
      tasks.set(taskId, task);
      return json(res, 201, { ok: true, task });
    } catch (err) {
      return json(res, 400, { ok: false, error: err.message });
    }
  }

  // List tasks
  if (req.method === "GET" && url === "/api/v1/tasks") {
    return json(res, 200, { tasks: Array.from(tasks.values()) });
  }

  // Get task by ID
  if (req.method === "GET" && url.startsWith("/api/v1/tasks/")) {
    const taskId = url.replace("/api/v1/tasks/", "");
    const task = tasks.get(taskId);
    if (task) return json(res, 200, task);
    return json(res, 404, { error: `task '${taskId}' not found` });
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[${SERVICE_NAME}] MCP server listening on port ${PORT} — ${CAPABILITIES.length} capabilities registered`);
});
