# Getting Started with Harbinger

Welcome to Harbinger! This guide will walk you through the initial setup and your first security hunt.

## Prerequisites

Before you begin, ensure you have the following installed:

-   **Docker and Docker Compose:** For containerizing Harbinger services.
-   **Git:** For cloning the Harbinger repository.
-   **Basic command-line knowledge:** Familiarity with terminal commands.

## Docker Compose Up

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Haribinger/Harbinger.git
    cd Harbinger
    ```
2.  **Start Harbinger services:**
    ```bash
    docker compose up -d
    ```
    This command will pull the necessary Docker images and start all Harbinger components in detached mode.

## Your First Hunt

Once all services are up and running, you can initiate your first security hunt. Refer to the `AGENT_GUIDE.md` and `TOOLS_GUIDE.md` for detailed information on configuring agents and utilizing available tools.
