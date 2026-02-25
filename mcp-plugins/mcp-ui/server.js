const http = require("http");

const PORT = parseInt(process.env.MCP_UI_PORT || "3003", 10);
const SERVICE_NAME = "mcp-ui";
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
        name: "MCP-UI Visualization Server",
        description:
          "Placeholder MCP server for the MCP-UI visualization and dashboard system.",
        capabilities: ["dashboard-rendering", "chart-generation", "real-time-updates"],
        status: "placeholder",
      })
    );
    return;
  }

  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      "<html><body><h1>MCP-UI</h1><p>Visualization server placeholder. Dashboard coming soon.</p></body></html>"
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[${SERVICE_NAME}] MCP placeholder server listening on port ${PORT}`);
});
