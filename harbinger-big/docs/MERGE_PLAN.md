# Harbinger Merge Plan

This document outlines a comprehensive plan for merging valuable assets from the PWAEngine repositories (`PWAEngine/Harbinger`, `PWAEngine/hexstrike-modules`, and `PWAEngine/AgentsUi`) into the main `Haribinger/Harbinger` repository. The goal is to consolidate and enhance the Harbinger product by integrating previously developed, yet unfinished, content.

## 1. Summary of Existing Strengths in `harbinger-main`

Before detailing the merge plan, it is important to acknowledge the existing components and strengths within the `harbinger-main` repository that should be preserved and built upon. Based on the directory listing, `harbinger-main` appears to have a well-defined structure for agents, skills, and configurations.

- **Agent Configuration**: Files like `AGENT.md`, `CRONS.json`, `HEARTBEAT.md`, `PI_SKILL_GUIDE.md`, `SOUL.md`, and `TRIGGERS.json` in the `config` directory indicate a robust system for defining agent behavior, scheduling tasks, and managing skills. The presence of `SOUL.md` and `HEARTBEAT.md` in `harbinger-main/config` suggests that these core concepts are already part of the main repository, which simplifies the integration of the PWAEngine versions.
- **Skill Management**: The `templates/pi-skills` directory contains various skill definitions such as `brave-search`, `browser-tools`, `gccli`, `gdcli`, `gmcli`, `transcribe`, `vscode`, and `youtube-transcript`. This indicates an established framework for integrating and managing diverse agent capabilities.
- **Docker Integration**: The `templates/docker` directory with `event-handler` and `job` configurations suggests a system for containerizing and deploying agent-related processes, which is crucial for scalability and reproducibility.
- **Testing Infrastructure**: The `test` directory with various subdirectories for `app`, `config`, `cron`, `docker`, `pi-skills`, and `triggers` indicates a commitment to testing and quality assurance.

## 2. Extracted Items from `PWAEngine/Harbinger`

The following items have been extracted from `PWAEngine/Harbinger` and are organized in the `/home/ubuntu/merge-ready/` directory. This section details their proposed destination in `harbinger-main`, necessary modifications, and priority for integration.

| Item | Source Path (PWAEngine/Harbinger) | Destination Path (harbinger-main) | Rebranding/Modification | Priority |
|---|---|---|---|---|
| SOUL.md (Agent Identity/Personality) | `SOUL.md` | `/docs/agents/SOUL.md` or merge with existing `config/SOUL.md` | Rebrand "Cipher" to "Harbinger's agents". Integrate or update existing `SOUL.md` in `harbinger-main/config`. | Critical |
| HEARTBEAT.md (Health Check System) | `HEARTBEAT.md` | `/docs/agents/HEARTBEAT.md` or merge with existing `config/HEARTBEAT.md` | Integrate or update existing `HEARTBEAT.md` in `harbinger-main/config`. | Critical |
| IDENTITY.md (Agent Identity Framework) | `IDENTITY.md` | `/docs/agents/IDENTITY.md` | Strip out old BugClaw/RedClaw business model. Focus on agent identity framework. | High |
| MEMORY system | `memory/` | `/agents/memory/` | Review dated entries pattern for compatibility and best practices. | High |
| KNOWLEDGE GRAPH | `knowledge-graph/` | `/agents/knowledge-graph/` | Review `entities.json`, `graph.json`, `relations.json` for schema and content. | High |
| AGENTS.md (Agent Roster System) | `AGENTS.md` | `/docs/agents/AGENTS.md` | Review and adapt for Harbinger's agent management. | Medium |
| TOOLS.md (Tool Configurations) | `TOOLS.md` | `/docs/tools/TOOLS.md` | Extract Shef (Shodan facets) and other relevant tool configs. Ensure compatibility. | High |
| WORKFLOWS (5 Production Workflows) | `workflows/` (continuous-recon, CVE monitor, news monitor, knowledge graph, stitch) | `/agents/workflows/` | Review and adapt the 5 production workflows (continuous-recon, CVE monitor, news monitor, knowledge graph, etc.) for Harbinger's architecture. The `stitch` directory contains MCP modules that should be moved to `/mcp-modules/`. | Critical |
| SKILLS (Security/Pentesting) | `skills/` (selected directories) | `/agents/skills/` | Identify and integrate relevant security/pentesting skill packs. Review `SKILL.md` files for rebranding and compatibility. | High |
| RECON (Findings Database) | `recon/findings-database.yml` | `/recon/findings-database.yml` | Review and adapt recon templates and `findings-database.yml`. | Medium |
| Business Docs | `targets/docs/` (various .md files) | `/docs/business/` | Review and extract useful business-related documentation, such as `monetization.md`, `understanding-bug-bounty.md`, etc. | Low |
| Config (MCP Configs) | `config/mcporter.json` | `/config/mcporter.json` | Integrate `mcporter.json` and any other relevant MCP configurations. | Critical |

## 3. Extracted Items from `PWAEngine/hexstrike-modules`

This repository contains MCP tool modules and configurations. These should be integrated into a dedicated MCP modules directory within `harbinger-main`.

| Item | Source Path (PWAEngine/hexstrike-modules) | Destination Path (harbinger-main) | Rebranding/Modification | Priority |
|---|---|---|---|---|
| All MCP Tool Modules and Configs | `hexstrike-modules/` | `/mcp-modules/` | Review each module for relevance and compatibility. Rebrand where necessary (e.g., 
RedClaw references). | High |

## 4. Extracted Items from `PWAEngine/AgentsUi`

This repository is a fork of PentAGI and contains UI components that could be valuable for Harbinger's user interface. The entire `frontend` directory has been copied to `/home/ubuntu/merge-ready/AgentsUi-frontend` for detailed review.

| Item | Source Path (PWAEngine/AgentsUi) | Destination Path (harbinger-main) | Rebranding/Modification | Priority |
|---|---|---|---|---|
| PentAGI Components | `frontend/` | `/ui/` or `/app/` | Review and integrate any PentAGI components not already present in `harbinger-main`. This will require a detailed comparison of the two frontends. | Medium |

## 5. Next Steps and Recommendations

1.  **Detailed Code Review**: Each extracted file and module must undergo a thorough code review to ensure it aligns with Harbinger's architecture, coding standards, and security policies.
2.  **Rebranding and Customization**: All extracted components must be rebranded to fit the Harbinger ecosystem. This includes updating names, logos, and any other brand-specific elements.
3.  **Integration and Testing**: Integrate the extracted components into the `harbinger-main` repository in a phased approach, starting with the highest-priority items. Each integration should be followed by comprehensive testing to ensure stability and functionality.
4.  **Documentation**: Update the `harbinger-main` documentation to reflect the newly integrated features and components.

This merge plan provides a high-level overview of the process. The actual implementation will require careful planning and execution to ensure a seamless and successful integration.
