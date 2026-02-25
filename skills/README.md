# Skills System Overview

This document outlines the Harbinger skills system, how agents learn, and how to add custom skills.

## How Agents Learn

Harbinger agents learn through a combination of pre-defined skills and continuous learning mechanisms. Each skill provides a structured approach to performing specific tasks, such as reconnaissance or vulnerability exploitation. Agents can adapt and improve their performance by applying these skills in various scenarios and learning from the outcomes.

## Adding Custom Skills

Custom skills can be added to the Harbinger system to extend its capabilities. Follow these steps to integrate new skills:

1.  **Define the Skill:** Create a new Markdown file in the `skills/` directory, detailing the methodology, tools, and commands associated with the skill.
2.  **Structure the Content:** Organize the skill content with clear headings, examples, and explanations. Use code blocks for commands and configurations.
3.  **Integrate with Agents:** Ensure the new skill is properly referenced and accessible by the agent framework. This may involve updating configuration files or skill manifests.
4.  **Test the Skill:** Thoroughly test the custom skill to verify its functionality and effectiveness in different scenarios.
