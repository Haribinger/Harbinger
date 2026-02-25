# 🦞 Harbinger - Professional Bug Bounty Hunting Platform

![Harbinger Logo](brand/harbinger-logo.png)

**Harbinger** is a comprehensive bug bounty hunting platform that combines autonomous agents, real-time visualization, and 150+ integrated security tools to revolutionize vulnerability discovery and management.

## 🌟 Key Features

### 🤖 Autonomous Agent System
- **PentAGI Integration**: Forked autonomous agent system for intelligent vulnerability hunting
- **AI-Powered Analysis**: OpenAI GPT-4, Anthropic Claude, and Google AI integration
- **Autonomous Scanning**: Self-directed security assessment workflows

### ⚡ HexStrike MCP - 150+ Security Tools
- **Nikto**: Web server vulnerability scanning
- **Nuclei**: Fast and customizable vulnerability scanner
- **Dirsearch**: Web path discovery
- **SQLMap**: SQL injection testing
- **Burp Suite**: Web application security testing
- **OWASP ZAP**: Comprehensive security testing
- **And 140+ more tools pre-integrated**

### 🎨 MCP-UI Visualization System
- **Real-time Attack Graphs**: Interactive vulnerability mapping
- **Live Terminal Sessions**: Watch security scans in real-time
- **Threat Intelligence Dashboards**: Comprehensive security insights
- **Interactive Knowledge Graphs**: Neo4j-powered relationship visualization

### 🕸️ Knowledge Graph Infrastructure
- **Neo4j Integration**: Advanced graph database for relationship mapping
- **PostgreSQL + pgvector**: Vector database for semantic search
- **Redis Caching**: High-performance data caching
- **Elasticsearch**: Full-text search and analytics

### 🔌 Complete MCP Integration
- **Model Context Protocol**: Seamless tool integration
- **Plugin Architecture**: Extensible system for custom tools
- **Real-time Communication**: WebSocket-driven live updates
- **API-First Design**: RESTful APIs for all functionality

## 🚀 Quick Start

### Option A — Docker (recommended)

Everything runs behind nginx on port 80. Single URL for everything.

```bash
git clone https://github.com/Haribinger/harbinger.git
cd harbinger
cp .env.example .env
# Edit .env — set DB_PASSWORD, JWT_SECRET, and optional service URLs
docker compose up -d
```

Open **http://localhost** — the Vite dashboard is the unified UI.

### Option B — Local Dev (Vite + Docker backend)

Starts the Vite SPA on :3000 with proxy to Docker-hosted backend on :8080.

```bash
# Start infrastructure + backend services
docker compose up -d postgres redis neo4j backend

# Install deps + start Vite dev server
pnpm install
pnpm dev
```

Open **http://localhost:3000** — Vite proxies `/api/*` → `localhost:8080`.

### Option C — Full local dev (Next.js harbinger npm package)

Only needed if developing the harbinger npm package itself.

```bash
pnpm dev:nextjs   # Next.js event handler on :3000
pnpm dev          # Vite dashboard on :3000
pnpm dev:all      # Both simultaneously (uses concurrently)
```

### Utilities

```bash
pnpm doctor       # Check env, backend, services — prints actionable fixes
pnpm reset        # Clear .next / frontend/dist / Vite cache
```

### Access

| Service | URL | Notes |
|---------|-----|-------|
| Dashboard (Vite SPA) | http://localhost (docker) or http://localhost:3000 (dev) | Primary UI |
| Backend API | http://localhost:8080/api/health | Go backend |
| Neo4j Browser | http://localhost:7474 | Graph DB |
| PostgreSQL | localhost:5432 | DB |

### Button → Endpoint Mapping

| UI Action | Component | Endpoint | Config Required |
|-----------|-----------|----------|-----------------|
| Dashboard stats | Dashboard | `GET /api/dashboard/stats` | None |
| Recent activity | Dashboard | `GET /api/dashboard/activity` | None |
| Service health dots | Dashboard | `GET /api/dashboard/health` | Service URLs in env |
| Spawn Container | Dashboard | `POST /api/docker/containers` | `DOCKER_SOCKET` |
| Open Browser | Dashboard | `POST /api/browsers/sessions` | `BROWSER_SERVICE_URL` |
| MCP Servers list | MCPManager | `GET /api/mcp/servers` | None |
| MCP Connect | MCPManager | (client-side toggle) | Service URL env var |
| Docker list | DockerManager | `GET /api/docker/containers` | `DOCKER_SOCKET` |
| Docker start/stop | DockerManager | `POST /api/docker/containers/{id}/start` | `DOCKER_SOCKET` |
| Service check | Settings | `POST /api/services/check` | Service URLs |
| Health check | Header/API | `GET /api/health` | None |

## ⚙️ Configuration

### Environment Variables

Harbinger is **completely configurable** through environment variables. No hardcoded values exist in the system.

Key configuration sections:

#### Application Core
```bash
APP_NAME=Harbinger
APP_VERSION=1.0.0
APP_ENV=development
APP_PORT=8080
```

#### Database Configuration
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=harbinger
DB_USER=harbinger
DB_PASSWORD=change-me
```

#### MCP Plugin System
```bash
MCP_ENABLED=true
MCP_PLUGINS_DIR=./mcp-plugins
MCP_HEXRIDGE_URL=http://localhost:3001
MCP_PENTAGI_URL=http://localhost:3002
```

#### Bug Bounty Platform Integration
```bash
HACKERONE_API_KEY=your-hackerone-api-key
BUGCROWD_API_KEY=your-bugcrowd-api-key
INTIGRITI_API_KEY=your-intigriti-api-key
```

#### AI Services
```bash
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
GOOGLE_AI_API_KEY=your-google-ai-api-key
```

## 🏗️ Architecture

### System Components

1. **Go Backend API** - High-performance microservices
2. **React Frontend** - Modern, responsive UI
3. **PostgreSQL** - Primary data store with pgvector
4. **Neo4j** - Knowledge graph database
5. **Redis** - Caching and session management
6. **Elasticsearch** - Search and analytics
7. **PentAGI Agents** - Autonomous security testing
8. **HexStrike MCP** - Security tool integration
9. **MCP-UI** - Real-time visualization

### Technology Stack

- **Backend**: Go, Gin, WebSocket, gRPC
- **Frontend**: React, TypeScript, Vite, WebSocket
- **Databases**: PostgreSQL, Neo4j, Redis, Elasticsearch
- **Containerization**: Docker, Docker Compose
- **Monitoring**: Prometheus, Grafana, Jaeger
- **Security**: OWASP ZAP, Nikto, Nuclei, SQLMap

## 📚 Documentation

- [Getting Started Guide](docs/getting-started.md)
- [API Reference](docs/api-reference.md)
- [Plugin Development](docs/plugin-development.md)
- [Deployment Guide](docs/deployment-guide.md)
- [Troubleshooting](docs/troubleshooting.md)

## 🔧 Development

### Prerequisites
- Go 1.21+
- Node.js 18+
- Docker and Docker Compose

### Backend Development
```bash
cd backend
go mod download
go run cmd/api/main.go
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Plugin Development
```bash
cd mcp-plugins
# Add your custom MCP plugins here
```

## 🐳 Deployment

### Docker Compose (Recommended)
```bash
docker-compose up -d
```

### Kubernetes
```bash
kubectl apply -f config/kubernetes/
```

### Production Deployment
1. Configure all environment variables in production
2. Set up SSL certificates
3. Configure monitoring and alerting
4. Set up backup strategies
5. Configure security policies

## 🔒 Security

### Production Security Checklist
- [ ] Change all default passwords
- [ ] Configure SSL/TLS certificates
- [ ] Set up firewall rules
- [ ] Enable audit logging
- [ ] Configure backup encryption
- [ ] Set up security monitoring
- [ ] Enable intrusion detection

## 📊 Monitoring

Harbinger includes comprehensive monitoring:

- **Prometheus**: Metrics collection
- **Grafana**: Dashboards and visualization
- **Jaeger**: Distributed tracing
- **ELK Stack**: Log aggregation and analysis

Access dashboards:
- Grafana: http://localhost:3004
- Prometheus: http://localhost:9091
- Jaeger: http://localhost:16686

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/harbinger/issues)
- **Discord**: [Join our Discord](https://discord.gg/harbinger)
- **Email**: support@harbinger.security

## 🙏 Acknowledgments

- **PentAGI**: Autonomous agent system framework
- **OWASP**: Security testing tools and standards
- **Neo4j**: Graph database technology
- **OpenAI, Anthropic**: AI capabilities
- **Security Community**: Tool authors and contributors

---

**🦞 Harbinger - Revolutionizing Bug Bounty Hunting**

*Built with ❤️ by the security community, for the security community*
