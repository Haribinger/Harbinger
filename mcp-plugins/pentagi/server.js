const http = require("http");

const PORT = parseInt(process.env.PENTAGI_PORT || "3002", 10);
const SERVICE_NAME = "pentagi";
const startedAt = new Date().toISOString();

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: SERVICE_NAME,
        version: "0.1.0-placeholder",
        uptime: process.uptime(),
        started_at: startedAt,
      })
    );
    return;
  }

  if (req.url === "/api/v1/info") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        name: "PentAGI Autonomous Agent",
        description:
          "Placeholder MCP server for the PentAGI autonomous penetration testing agent system.",
        capabilities: ["autonomous-recon", "exploit-chain", "report-generation"],
        status: "placeholder",
      })
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[${SERVICE_NAME}] MCP placeholder server listening on port ${PORT}`);
});
