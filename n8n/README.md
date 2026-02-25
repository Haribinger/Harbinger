# n8n Integration with Harbinger

This guide explains how to integrate and utilize n8n with Harbinger for powerful workflow automation.

## Setup Instructions

1.  **Prerequisites:** Ensure you have Docker and Docker Compose installed on your system.
2.  **Navigate to n8n directory:** `cd harbinger-final/n8n`
3.  **Start n8n:** Use the provided `docker-compose.n8n.yml` to start the n8n service:
    ```bash
    docker compose -f docker-compose.n8n.yml up -d
    ```
4.  **Access n8n:** Open your web browser and navigate to `http://localhost:5678`. You will be prompted for basic authentication. Use the credentials defined in `docker-compose.n8n.yml` (default: `harbinger`/`changeme`).

## Importing Workflows

Harbinger provides pre-built n8n workflows to automate common security tasks. To import a workflow:

1.  **Download Workflow JSON:** The workflow JSON files are located in the `n8n/workflows/` directory.
2.  **Open n8n:** Access your running n8n instance in your browser.
3.  **Import:** In the n8n interface, click on "Workflows" in the left sidebar, then click "New" -> "Import from JSON". Paste the content of the workflow JSON file and click "Import".
4.  **Activate:** After importing, activate the workflow by toggling the "Active" switch in the top right corner of the workflow editor.

## Harbinger API Interaction

n8n workflows can interact with the Harbinger API to trigger actions, retrieve data, and automate responses. Key API endpoints for integration include:

-   `/bounty/sync`: To synchronize bounty programs and targets.
-   `/agents/run`: To initiate security agents on specific targets.
-   `/findings/collect`: To collect and process findings from agents.
