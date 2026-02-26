# Getting Started with Harbinger

Welcome to Harbinger! This guide will walk you through the initial setup and your first security hunt.

## Prerequisites

Before you begin, ensure you have the following installed:

-   **Docker and Docker Compose:** For containerizing Harbinger services.
-   **Git:** For cloning the Harbinger repository.
-   **Basic command-line knowledge:** Familiarity with terminal commands.

## Automated Installation (Recommended)

For a quick and easy setup, use the one-command installer:

1.  **Run the installer script:**
    ```bash
    git clone https://github.com/Haribinger/Harbinger.git
    cd Harbinger
    ./scripts/install.sh
    ```

This script will:
- Check for necessary prerequisites (Docker, Docker Compose, Git).
- Clone the repository if not already in one.
- Create a `.env` file from `.env.example` if it doesn't exist.
- Create the `harbinger-net` Docker network.
- Build and start all Harbinger services using Docker Compose.

After the script completes, open your browser to `http://localhost:3000`. The setup wizard will guide you through the initial configuration (API keys, VPS, agents, etc.).

## Manual Installation

If you prefer a manual setup, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Haribinger/Harbinger.git
    cd Harbinger
    ```
2.  **Synchronize with remote (important for collaborative development):**
    ```bash
    ./scripts/harbinger-sync.sh pull
    ```
    This command fetches remote changes and rebases your local branch to prevent merge conflicts.
3.  **Setup environment variables:**
    ```bash
    cp .env.example .env
    ```
    Edit the `.env` file to configure your settings, or use the setup wizard after starting the services.
4.  **Start Harbinger services:**
    ```bash
    docker compose up -d
    ```
    This command will pull the necessary Docker images and start all Harbinger components in detached mode.

## Harbinger Sync Script Usage

The `harbinger-sync.sh` script helps prevent merge conflicts when working with collaborators or AI agents.

-   **Pull changes safely:**
    ```bash
    ./scripts/harbinger-sync.sh pull
    ```
    Fetches remote changes and attempts to rebase your local branch. If rebase fails, it tries a merge.
-   **Sync and push your changes:**
    ```bash
    ./scripts/harbinger-sync.sh push
    ```
    First pulls remote changes, then commits any uncommitted local changes (prompting for a message if none is provided), and finally pushes to the remote. If the push fails, it attempts a `force-with-lease`.
-   **Check sync status:**
    ```bash
    ./scripts/harbinger-sync.sh status
    ```
    Shows whether your local branch is in sync with the remote, ahead, or behind.

## Your First Hunt

Once all services are up and running, you can initiate your first security hunt. Refer to the `AGENT_GUIDE.md` and `TOOLS_GUIDE.md` for detailed information on configuring agents and utilizing available tools.

## Troubleshooting

### Common Docker Issues

-   **
Common Docker Issues

-   **Containers not starting:** Check `docker compose logs` for error messages.
-   **Port conflicts:** Ensure ports `3000` (frontend) and `8080` (backend) are not in use by other applications. You can change these in the `.env` file.
-   **Permissions issues:** If you encounter permission errors related to Docker, ensure your user is part of the `docker` group (`sudo usermod -aG docker $USER && newgrp docker`).

### Node.js Issues (for frontend development)

-   **`npm install` or `pnpm install` failures:** Check your Node.js version (Harbinger typically uses LTS versions). Clear cache (`npm cache clean --force` or `pnpm store prune`) and try again.
-   **Frontend not compiling:** Ensure all dependencies are installed and check the console for build errors.

If you encounter persistent issues, please refer to the official Docker and Node.js documentation or open an issue on the Harbinger GitHub repository.
