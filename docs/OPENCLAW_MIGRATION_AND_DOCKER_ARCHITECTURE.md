# Harbinger OpenClaw Migration and Architecture Specification

## Executive Summary

This document outlines a comprehensive strategy for Harbinger to attract and absorb users from OpenClaw, an AI coding agent. The core of this strategy involves creating a robust compatibility layer for OpenClaw's existing workspace formats, skills, and agent configurations, alongside introducing a novel Docker-per-Agent architecture within Harbinger's agent swarm. This approach aims to provide OpenClaw users with a seamless migration path, preserving their existing work while offering enhanced capabilities in a specialized offensive security context.

## 1. OpenClaw Overview

OpenClaw is a personal AI assistant designed to automate various tasks, often with a focus on coding and general productivity. It operates through a system of agents, skills, and a defined workspace structure.

### 1.1. Workspace Format

OpenClaw agents manage their state and configuration within a dedicated directory structure, typically `~/.openclaw/`. Key files and directories include:

*   **`.openclaw/`**: The primary directory for OpenClaw's internal state and configuration [1].
*   **`workspace-state.json`**: This file, located within the `.openclaw/` directory, likely stores the current state of the agent's workspace, including active sessions, loaded skills, and other dynamic information [2].
*   **`openclaw.json`**: An optional JSON5 configuration file located at `~/.openclaw/openclaw.json`. It defines various gateway and agent settings, and if missing, OpenClaw uses safe defaults [3]. This file can contain configurations for channels, agent defaults, tools, and more [4].
*   **`.clawhub/`**: This directory, often found within a skill's folder or the workdir, contains local install metadata (`origin.json`) and workdir install state (`lock.json`) for skills [5].
*   **`lock.json`**: Located at `<workdir>/.clawhub/lock.json`, this file records the installed skills within a specific working directory [5].

### 1.2. How OpenClaw Agents/Sessions Work

OpenClaw agents leverage a skill system, memory, and configurable settings to perform tasks. The core components are:

*   **Skills**: Defined by `SKILL.md` files, which are Markdown documents with optional YAML frontmatter. The frontmatter declares metadata such as the skill's name, description, version, and runtime requirements (e.g., environment variables, CLI binaries, install specs) [5]. Skills are organized in folders, and only text-based files are accepted for publishing [5].
*   **Souls**: An agent's personality and core directives are defined in a `SOUL.md` file, which is a Markdown file with optional YAML frontmatter for metadata [6].
*   **Memory/Context**: OpenClaw agents maintain context through their workspace and potentially through explicit memory management. The `openclaw.json` configuration allows for settings related to context pruning and compaction [4]. Some community projects also focus on capturing and maintaining long-term memory for OpenClaw sessions [7].
*   **Configuration**: Agents are configured via `openclaw.json`, which allows for setting defaults for agents, such as their workspace directory (`agents.defaults.workspace`), repository root (`agents.defaults.repoRoot`), and whether to skip bootstrap processes (`agents.defaults.skipBootstrap`) [4].
*   **Sessions**: OpenClaw agents can run tasks in sessions, often leveraging a `bash` tool with PTY mode for interactive terminal applications. These sessions can be run in the background, monitored, and interacted with via process actions (e.g., `log`, `write`, `submit`, `kill`) [8].

### 1.3. How OpenClaw Users Currently Set Up Their Workspace

OpenClaw users typically set up their workspace by creating a `~/.openclaw` directory and placing their `openclaw.json` configuration file within it. Skills are often organized in a `skills` folder within the `.openclaw` directory or a designated workdir [9]. The CLI tool (`clawhub`) is used for logging in, installing, updating, publishing, and managing skills [10]. Users often configure their agents to interact with various messaging platforms and define custom commands [4].

## 2. BYOA (Bring Your Own Agent) System

Harbinger will implement a 
BYOA (Bring Your Own Agent) system that allows external agents, including OpenClaw, to be integrated into Harbinger's swarm.

### 2.1. Agent Adapter Interface

Harbinger will provide a well-defined agent adapter interface, enabling the wrapping of any external agent to communicate using Harbinger's internal protocol. This interface will abstract away the underlying agent's specific communication mechanisms, skill execution, and memory management, presenting a unified API to the Harbinger core.

### 2.2. Auto-Detect Agent Type

The `harbinger import` command will include functionality to auto-detect the type of external agent based on characteristic workspace files. For OpenClaw, this will involve identifying the presence of `.openclaw/` directories, `workspace-state.json`, `openclaw.json`, and `.clawhub/` structures. Similar detection mechanisms will be developed for other agents like Cursor (`.cursor/`) and Claude Desktop MCP configurations.

### 2.3. One-Command Migration

Users will be able to migrate their existing agent workspaces with a single command:

```bash
harbinger import --from openclaw /path/to/openclaw/workspace
```

This command will trigger the auto-detection, adapter creation, and subsequent import of the agent's configuration, skills, and memory into Harbinger.

## 3. OpenClaw Compatibility Layer

To ensure a smooth transition for OpenClaw users, Harbinger will implement a dedicated compatibility layer.

### 3.1. Workspace File Parsing

Harbinger will be able to parse and interpret key OpenClaw workspace files:

*   **`.openclaw/workspace-state.json`**: This file will be parsed to extract information about active sessions, agent states, and other runtime data. This data will be mapped to Harbinger's internal session and state management systems.
*   **`.clawhub/lock.json`**: This file, which lists installed skills, will be parsed to identify and import OpenClaw skills into Harbinger's skill management system.

### 3.2. Skill Import

OpenClaw skills, defined by `SKILL.md` files with YAML frontmatter, will be imported into Harbinger's agents/skills/ format. This will involve:

*   **Metadata Extraction**: Parsing the YAML frontmatter to extract skill name, description, version, and runtime requirements (environment variables, binaries, install specs).
*   **Content Conversion**: Converting the Markdown content of `SKILL.md` into Harbinger's skill definition format, preserving the original instructions and logic.
*   **Dependency Mapping**: Mapping OpenClaw's `install` specs (e.g., `brew`, `node`, `go`, `uv`) to Harbinger's dependency management system, ensuring that required tools are available within the agent's environment.

### 3.3. Memory and Context Import

Harbinger will import OpenClaw's memory and context into its own memory system. This includes:

*   **Session History**: Importing chat logs and interaction history to maintain continuity of agent conversations.
*   **Learned Information**: Extracting and integrating any long-term memory or learned knowledge from OpenClaw's workspace into Harbinger's knowledge graph.
*   **Configuration Settings**: Mapping OpenClaw's context-related configuration settings (e.g., context pruning, compaction) to equivalent Harbinger settings.

### 3.4. Session Mapping

OpenClaw sessions will be mapped to Harbinger agent sessions. This means that an ongoing OpenClaw task can be resumed or continued within the Harbinger environment, with the agent retaining its context and ability to execute skills.

### 3.5. Tool Calling Format Support

Harbinger will support OpenClaw's tool calling format alongside its own Model Context Protocol (MCP). This will allow imported OpenClaw skills to function without immediate re-engineering, providing a gradual transition path for users.

## 4. "Add to Swarm" Feature

Upon successful import, any external agent will be integrated into the Harbinger swarm, gaining access to its collaborative features.

### 4.1. Agent Identity and Heartbeat

Each imported agent will be assigned a unique identity, a "soul" (personality and core directives), and a "heartbeat" within the Harbinger system. This ensures that the agent is a fully recognized and active member of the swarm.

### 4.2. Customizable Personality, Tools, and Role

Users will be able to customize the imported agent's personality (based on its `SOUL.md` equivalent), assign specific tools from Harbinger's arsenal, and define its role within the swarm (e.g., recon-scout, web-hacker, exploit-dev).

### 4.3. Collaborative Capabilities

Imported agents will be able to collaborate seamlessly with native Harbinger agents. This includes:

*   **Shared Task Execution**: Participating in multi-agent tasks, contributing their specialized skills and knowledge.
*   **Inter-Agent Communication**: Communicating with other agents in the swarm to share findings, request assistance, and coordinate actions.

### 4.4. Shared Knowledge Graph

All agents in the Harbinger swarm, including imported ones, will contribute to and read from a shared knowledge graph. This centralized repository of information will allow agents to leverage collective intelligence, accelerate learning, and improve overall operational effectiveness.

## 5. Migration CLI Tool Spec

The `harbinger` CLI tool will be enhanced with a dedicated `import` command and `agent` subcommands to facilitate migration and management of agents.

### 5.1. `harbinger import`

*   **`harbinger import`**: Detects and imports agents from any supported platform (e.g., OpenClaw, Cursor, Claude Desktop MCP config).
*   **`harbinger import --from openclaw /path/to/workspace`**: Specifically imports an OpenClaw workspace.
*   **`harbinger import --from cursor /path/to/workspace`**: Imports a Cursor workspace.
*   **`harbinger import --from claude /path/to/mcp_config`**: Imports a Claude Desktop MCP configuration.

### 5.2. `harbinger agent` Subcommands

*   **`harbinger agent add <type> <name>`**: Adds a new custom agent to the swarm, specifying its type (e.g., `recon-scout`, `web-hacker`) and a unique name.
*   **`harbinger agent list`**: Displays a list of all agents currently in the swarm, along with their status and roles.
*   **`harbinger agent customize <name>`**: Allows users to edit an agent's soul (personality), assigned tools, and configuration.

## 6. Docker-per-Agent Architecture

Harbinger will adopt a **Docker-per-Agent Architecture**, where each agent operates within its own isolated Docker container. This design provides robust encapsulation, scalability, and flexibility for agent management and evolution.

### 6.1. Key Concepts

*   **Container as Agent's Life**: Each agent's entire operational environment, including its operating system, dependencies, tools, and runtime, is encapsulated within a dedicated Docker container. The container *is* the agent's life, workspace, and environment.
*   **Persistent State**: Containers are configured with persistent volume mounts, ensuring that an agent's memory, findings, acquired skills, and accumulated knowledge persist across container restarts and updates. This prevents data loss and allows agents to continuously learn and evolve.
*   **Evolving Agents**: Agents can install new tools, customize their environment, and evolve their setup within their respective containers. This self-modification capability is crucial for agents to adapt to new challenges and improve their effectiveness.
*   **Inter-Agent Communication**: Agents communicate with each other via a secure internal network, utilizing protocols such as gRPC or WebSocket mesh. This enables agents to share findings, hand off work, and collectively enhance their intelligence and capabilities.
*   **Parallel Processing**: The Docker-per-Agent model inherently supports parallel processing. Users can connect multiple systems (e.g., local machines, VPS, cloud instances) to the Harbinger swarm, effectively adding more Docker hosts and increasing the parallel computational power available to the agents.
*   **Sub-Container Spawning**: Advanced agents can spawn temporary sub-containers for specific, isolated tasks. For example, a `Web Hacker` agent might spawn a dedicated Burp Suite container for a specific web application test, ensuring tool isolation and resource management.
*   **Full Isolation**: Each agent operates in a fully isolated environment. A crash or compromise of one agent's container does not affect other agents in the swarm, enhancing overall system stability and security.
*   **Scalability**: The architecture is highly scalable. Adding more Docker hosts (physical or virtual) directly translates to a larger and more powerful agent swarm, capable of handling more complex and concurrent tasks.
*   **Network and Security Configuration**: Each agent container can have its own proxy chain, network configuration, and fine-grained security settings, allowing for specialized operational profiles tailored to the agent's role (e.g., a `Recon Scout` might use a different proxy chain than an `Exploit Dev`).
*   **Orchestration**: Docker Compose or Kubernetes can be used to orchestrate the deployment and management of the agent swarm. While orchestration tools manage the overall infrastructure, agents retain the ability to dynamically scale and manage their own resources within the defined constraints.

### 6.2. Implementation Details

*   **Docker Image Spec**: Harbinger will provide base Docker images for different agent types (e.g., `harbinger/recon-scout`, `harbinger/web-hacker`, `harbinger/exploit-dev`). These images will come pre-installed with essential tools and configurations for their respective roles.
*   **Volume Mounts**: Persistent data for each agent (memory, findings, skills, configuration) will be stored in Docker volumes, mounted into the agent's container. This ensures data persistence and portability.
*   **Inter-Agent Communication Protocol**: A high-performance, low-latency communication protocol (e.g., gRPC for structured data exchange, WebSocket for real-time streaming) will be implemented to facilitate communication between agents.
*   **Customization of Docker Images**: Users will be able to customize any agent's Docker image by providing their own Dockerfiles or by extending existing Harbinger base images. This allows for highly specialized agent configurations.
*   **Community Registry**: Harbinger will establish a community registry where users can publish and share their custom agent Docker images, fostering a collaborative ecosystem of specialized agents.
*   **Distributed Swarm**: Connecting more systems (VPS, cloud instances, local machines) will involve deploying Docker hosts on these systems and registering them with the central Harbinger control plane. This expands the swarm's computational capacity and geographical distribution.

## 7. Why Users Switch

Harbinger offers compelling advantages for OpenClaw users, encouraging migration and adoption.

### 7.1. Specialized Offensive Security

While OpenClaw is a generic AI coding agent, Harbinger is purpose-built for **specialized offensive security**. This focus means that Harbinger's agents, tools, and workflows are optimized for tasks such as reconnaissance, vulnerability analysis, exploitation, and post-exploitation, providing a more effective and tailored solution for security professionals.

### 7.2. Agent Swarm and Collaborative Intelligence

OpenClaw operates primarily with individual agents. Harbinger, in contrast, features a sophisticated **agent swarm** with a "heartbeat" and a shared knowledge graph. This means:

*   **Team-Oriented Approach**: Harbinger gives agents a team to work with, rather than just a solo session. Agents can collaborate, share insights, and collectively solve complex security challenges.
*   **Enhanced Capabilities**: The swarm architecture enables emergent behaviors and capabilities that are not possible with single agents, leading to more comprehensive and efficient security operations.

### 7.3. Knowledge Graph and Contextual Awareness

Harbinger's **shared knowledge graph** provides a persistent and evolving repository of information. Imported agents contribute to and read from this graph, significantly enhancing their contextual awareness and ability to make informed decisions. This is a significant upgrade from OpenClaw's more localized memory and context management.

### 7.4. Full Visualization

Harbinger will offer **full visualization** of everything an agent does, from its thought processes and actions to its interactions with other agents and external systems. This transparency provides users with unprecedented insight into their agents' operations, facilitating debugging, auditing, and trust.

### 7.5. Zero-Loss Migration

Crucially, Harbinger's compatibility layer ensures that OpenClaw users can migrate their existing work (skills, memory, context) with **zero loss**. This commitment to preserving user investment makes the transition to Harbinger seamless and risk-free.

## References

[1] OpenClaw Security Guide. *atomicmail.io*. [https://atomicmail.io/blog/using-openclaw-ai-safely-full-privacy-security-guide?ref=dangai](https://atomicmail.io/blog/using-openclaw-ai-safely-full-privacy-security-guide?ref=dangai)
[2] How We Built a Squad of Autonomous AI Agents. *linkedin.com*. [https://www.linkedin.com/pulse/how-we-built-squad-autonomous-ai-agents-dashboard-run-pachipulusu-xjqyc](https://www.linkedin.com/pulse/how-we-built-squad-autonomous-ai-agents-dashboard-run-pachipulusu-xjqyc)
[3] Configuration - OpenClaw. *docs.openclaw.ai*. [https://docs.openclaw.ai/gateway/configuration](https://docs.openclaw.ai/gateway/configuration)
[4] Configuration Reference - OpenClaw. *docs.openclaw.ai*. [https://docs.openclaw.ai/gateway/configuration-reference](https://docs.openclaw.ai/gateway/configuration-reference)
[5] clawhub/docs/skill-format.md. *github.com*. [https://github.com/openclaw/clawhub/blob/main/docs/skill-format.md](https://github.com/openclaw/clawhub/blob/main/docs/skill-format.md)
[6] clawhub/docs/soul-format.md. *github.com*. [https://github.com/openclaw/clawhub/blob/main/docs/soul-format.md](https://github.com/openclaw/clawhub/blob/main/docs/soul-format.md)
[7] geq1fan/openclaw-memory. *github.com*. [https://github.com/geq1fan/openclaw-memory](https://github.com/geq1fan/openclaw-memory)
[8] openclaw/skills/coding-agent/SKILL.md. *github.com*. [https://github.com/openclaw/openclaw/blob/main/skills/coding-agent/SKILL.md](https://github.com/openclaw/openclaw/blob/main/skills/coding-agent/SKILL.md)
[9] Setting Up Skills In Openclaw. *medium.com*. [https://nwosunneoma.medium.com/setting-up-skills-in-openclaw-d043b76303be](https://nwosunneoma.medium.com/setting-up-skills-in-openclaw-d043b76303be)
[10] clawhub/docs/cli.md. *github.com*. [https://github.com/openclaw/clawhub/blob/main/docs/cli.md](https://github.com/openclaw/clawhub/blob/main/docs/cli.md)
