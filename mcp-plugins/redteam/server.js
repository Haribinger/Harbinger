const http = require("http");

const PORT = parseInt(process.env.REDTEAM_PORT || "3004", 10);
const SERVICE_NAME = "redteam";
const startedAt = new Date().toISOString();

// Red team operation tools — C2, lateral movement, persistence, AD attack paths.
// Mirrors what the frontend RedTeam page and mcpStore expect.
const TOOLS = [
  // C2 Frameworks
  { id: "mythic_agent", name: "Mythic Agent", category: "C2 Frameworks", description: "Deploy and manage Mythic C2 agents" },
  { id: "sliver_implant", name: "Sliver Implant", category: "C2 Frameworks", description: "Generate and manage Sliver C2 implants" },
  { id: "havoc_demon", name: "Havoc Demon", category: "C2 Frameworks", description: "Deploy Havoc framework demons" },
  { id: "cobalt_beacon", name: "Cobalt Strike Beacon", category: "C2 Frameworks", description: "Manage Cobalt Strike beacons" },

  // Lateral Movement
  { id: "psexec_move", name: "PsExec", category: "Lateral Movement", description: "Remote execution via PsExec/Impacket" },
  { id: "wmiexec_move", name: "WMIExec", category: "Lateral Movement", description: "WMI-based remote command execution" },
  { id: "evil_winrm", name: "Evil-WinRM", category: "Lateral Movement", description: "WinRM shell with PowerShell support" },
  { id: "ssh_pivot", name: "SSH Pivot", category: "Lateral Movement", description: "SSH tunneling and pivoting" },
  { id: "socks_proxy", name: "SOCKS Proxy", category: "Lateral Movement", description: "Dynamic SOCKS proxy through compromised hosts" },

  // Active Directory
  { id: "bloodhound_attack", name: "BloodHound Attack Path", category: "Active Directory", description: "Find and exploit AD attack paths" },
  { id: "kerberoast", name: "Kerberoasting", category: "Active Directory", description: "Extract and crack service account TGS tickets" },
  { id: "asreproast", name: "AS-REP Roasting", category: "Active Directory", description: "Target accounts without pre-auth" },
  { id: "dcsync_attack", name: "DCSync", category: "Active Directory", description: "Extract password hashes via directory replication" },
  { id: "golden_ticket", name: "Golden Ticket", category: "Active Directory", description: "Forge Kerberos TGT for domain persistence" },
  { id: "silver_ticket", name: "Silver Ticket", category: "Active Directory", description: "Forge service tickets for specific services" },

  // Persistence
  { id: "scheduled_task", name: "Scheduled Task", category: "Persistence", description: "Create scheduled tasks for persistence" },
  { id: "registry_run", name: "Registry Run Key", category: "Persistence", description: "Add registry autorun entries" },
  { id: "dll_hijack", name: "DLL Hijacking", category: "Persistence", description: "Plant DLLs in search-order hijack paths" },
  { id: "webshell_deploy", name: "Web Shell", category: "Persistence", description: "Deploy web shells on compromised servers" },

  // Evasion
  { id: "amsi_bypass", name: "AMSI Bypass", category: "Evasion", description: "Bypass Antimalware Scan Interface" },
  { id: "applocker_bypass", name: "AppLocker Bypass", category: "Evasion", description: "Bypass application whitelisting" },
  { id: "uac_bypass", name: "UAC Bypass", category: "Evasion", description: "Bypass User Account Control" },

  // Social Engineering
  { id: "phishing_campaign", name: "Phishing Campaign", category: "Social Engineering", description: "Orchestrate phishing engagements" },
  { id: "payload_delivery", name: "Payload Delivery", category: "Social Engineering", description: "Multi-vector payload delivery" },
];

// In-memory playbook storage
const playbooks = new Map();
const operations = new Map();

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
      tools_count: TOOLS.length,
      active_operations: operations.size,
    });
  }

  if (url === "/api/v1/info") {
    return json(res, 200, {
      name: "Red Team Operations",
      description: "MCP server for red team operations — C2 integration, AD attack paths, lateral movement, and persistence.",
      version: "1.0.0",
      tools_count: TOOLS.length,
      categories: [...new Set(TOOLS.map((t) => t.category))],
      status: "ready",
    });
  }

  // Tool inventory
  if (url === "/api/v1/tools") {
    return json(res, 200, { tools: TOOLS });
  }

  // Single tool lookup
  if (url.startsWith("/api/v1/tools/") && !url.includes("/api/v1/tools/../")) {
    const toolId = url.replace("/api/v1/tools/", "");
    const tool = TOOLS.find((t) => t.id === toolId);
    if (tool) return json(res, 200, tool);
    return json(res, 404, { error: `tool '${toolId}' not found` });
  }

  // Category listing
  if (url === "/api/v1/categories") {
    const categories = {};
    TOOLS.forEach((t) => {
      if (!categories[t.category]) categories[t.category] = [];
      categories[t.category].push(t.id);
    });
    return json(res, 200, { categories });
  }

  // Playbook CRUD
  if (req.method === "POST" && url === "/api/v1/playbooks") {
    try {
      const body = await parseBody(req);
      const id = `pb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const playbook = {
        id,
        name: body.name || "Unnamed Playbook",
        description: body.description || "",
        steps: body.steps || [],
        created_at: new Date().toISOString(),
      };
      playbooks.set(id, playbook);
      return json(res, 201, { ok: true, playbook });
    } catch (err) {
      return json(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === "GET" && url === "/api/v1/playbooks") {
    return json(res, 200, { playbooks: Array.from(playbooks.values()) });
  }

  // Operation tracking
  if (req.method === "POST" && url === "/api/v1/operations") {
    try {
      const body = await parseBody(req);
      const id = `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const op = {
        id,
        name: body.name || "Unnamed Operation",
        target: body.target || "",
        playbook_id: body.playbook_id || null,
        status: "planning",
        created_at: new Date().toISOString(),
        findings: [],
      };
      operations.set(id, op);
      return json(res, 201, { ok: true, operation: op });
    } catch (err) {
      return json(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === "GET" && url === "/api/v1/operations") {
    return json(res, 200, { operations: Array.from(operations.values()) });
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[${SERVICE_NAME}] MCP server listening on port ${PORT} — ${TOOLS.length} tools registered`);
});
