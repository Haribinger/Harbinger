# Harbinger Go Security Tools

Integrated from [1hehaq](https://github.com/1hehaq) and the open-source community.
All tools are Go-based and can be built with `go build`.

## Core Tools

| Tool | Source | Purpose | Agent |
|------|--------|---------|-------|
| shef | 1hehaq/shef | Shodan facets without API key | PATHFINDER |
| idor-mcp | 1hehaq/idor-mcp | IDOR vulnerability MCP server | BREACH |
| recx | 1hehaq/recx | Reflected parameter crawler | BREACH |
| roq | 1hehaq/roq | API key/credential validator | SPECTER |
| ceye | 1hehaq/ceye | Certificate transparency monitor | PATHFINDER |
| faviqon | 1hehaq/faviqon | Favicon hash + Shodan dork gen | PATHFINDER |
| ppmap | 1hehaq/ppmap | Prototype pollution scanner | BREACH |
| pdsi | 1hehaq/pdsi | PDF sensitive content scanner | SPECTER |
| conquer | 1hehaq/conquer | Subdomain takeover tool | PATHFINDER |
| dorq | 1hehaq/dorq | Minimal dorking tool | PATHFINDER |
| xssmap | 1hehaq/xssmap | XSS mapping/scanning | BREACH |
| jsus | 1hehaq/jsus | JavaScript secret scanner | BREACH |

## MCP Servers

| Server | Source | Purpose |
|--------|--------|---------|
| idor-mcp | 1hehaq/idor-mcp | IDOR testing via MCP protocol |
| mcpwn | Teycir/Mcpwn | MCP server security auditing |

## Build All Tools

```bash
./tools/go-tools/build-all.sh
```

## Caido Integration

Caido replaces Burp Suite as the primary web proxy:
- Modern, fast (Rust-based)
- GraphQL API for automation
- Plugin system for custom extensions
- Docker-ready: `docker run -p 8080:8080 caido/caido`
