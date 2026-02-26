# Agent Guide: Meet the Swarm

Harbinger operates with a swarm of intelligent agents, each designed with specific personalities and capabilities to tackle various aspects of security assessments. This guide introduces you to the agent ecosystem and how to customize them for your needs.

## Agent Personalities

Each agent within the Harbinger swarm possesses a distinct personality, influencing its approach to tasks. These personalities are defined by their core directives, preferred tools, and decision-making heuristics. Examples include:

-   **Reconnaissance Agent:** Focused on information gathering, utilizing tools like `subfinder`, `dnsx`, and `httpx` to map out target surfaces.
-   **Exploitation Agent:** Specializes in identifying and exploiting vulnerabilities, with a preference for tools like `SQLMap` and `XSStrike`.
-   **Reporting Agent:** Dedicated to synthesizing findings, generating comprehensive reports, and ensuring clear communication of risks.

## Customization

Harbinger agents are highly customizable, allowing users to tailor their behavior and capabilities. Customization options include:

-   **Skill Assignment:** Assigning specific skills (e.g., `skills/recon/port-scanning.md`) to agents based on the assessment's requirements.
-   **Configuration Parameters:** Adjusting parameters such as scan aggressiveness, target scope, and reporting verbosity.
-   **New Skill Integration:** Developing and integrating new skills to expand agent functionalities (refer to `skills/README.md`).
-   **Personality Tuning:** Modifying an agent's core directives and decision-making logic to align with specific operational security postures or client requirements.
