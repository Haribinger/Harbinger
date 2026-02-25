# Harbinger Agent System

The Harbinger framework utilizes a system of fully independent, customizable agents, each designed with a specific role and personality to tackle various aspects of offensive security.

## Agent Philosophy

Each agent is a distinct entity, possessing its own:

- **Soul (SOUL.md):** Defines the agent's core personality, communication style, and guiding motto. This shapes how the agent approaches tasks and interacts with information.
- **Identity (IDENTITY.md):** Specifies the agent's name, codename, primary role, and areas of specialization.
- **Tools (TOOLS.md):** Lists the primary command-line tools and APIs the agent is proficient with, along with usage examples for each.
- **Configuration (CONFIG.yaml):** Contains operational parameters such as the AI model to use, temperature settings, Docker image, proxy chain requirements, and handoff rules.
- **Skills (SKILLS.md):** Outlines the advanced techniques, methodologies, and knowledge domains the agent has mastered.

## Inter-Agent Handoff

Agents are designed to collaborate by handing off tasks to each other. For example, a `Recon Scout` might discover an interesting web application and hand off its findings to a `Web Hacker` for vulnerability assessment. The `CONFIG.yaml` file for each agent defines `handoff_to` (which agents it can pass tasks to) and `receives_from` (which agents it accepts tasks from).

## Customization and Extensibility

The Harbinger agent system is built for maximum customizability:

- **Modify Existing Agents:** Users can modify any aspect of an existing agent by editing its `SOUL.md`, `IDENTITY.md`, `TOOLS.md`, `CONFIG.yaml`, or `SKILLS.md` files.
- **Add New Tools:** New tools can be added to an agent's `TOOLS.md` file, complete with usage examples.
- **Change AI Models/Parameters:** The `CONFIG.yaml` allows for easy modification of the underlying AI model, temperature (creativity/precision), and other operational parameters.
- **Create New Agents:** Users can create entirely new agents tailored to specific needs. A `_template/` directory is provided as a starting point.

## Agent Learning and Improvement

Agents are designed to learn and improve over time:

- **Skills Growth:** As agents perform tasks, their `SKILLS.md` can be updated to reflect new techniques or methodologies they have mastered.
- **Knowledge Graph Integration:** Agents like the `OSINT Detective` can feed into a central knowledge graph, allowing all agents to benefit from correlated intelligence and improve their effectiveness over time.

## How to Create a Custom Agent

To create a new agent, follow these steps:

1.  **Copy Template:** Duplicate the `agents/_template/` directory and rename it to your new agent's name (e.g., `agents/my-new-agent/`).
2.  **Modify Files:** Edit the `SOUL.md`, `IDENTITY.md`, `TOOLS.md`, `CONFIG.yaml`, and `SKILLS.md` files within your new agent's directory to define its unique characteristics.
3.  **Integrate:** Update the `handoff_to` and `receives_from` fields in the `CONFIG.yaml` of other relevant agents to integrate your new agent into the workflow.
