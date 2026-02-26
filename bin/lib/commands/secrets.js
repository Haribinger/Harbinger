/**
 * harbinger set-agent-secret / set-agent-llm-secret / set-var
 * Extracted from the original monolithic cli.js.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { C, ICON } from '../ui.js';
import { loadRepoInfo } from '../api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageDir = path.join(__dirname, '..', '..', '..');

async function promptForValue(key) {
  const { password, isCancel } = await import('@clack/prompts');
  const value = await password({
    message: `Enter value for ${key}:`,
    validate: (input) => {
      if (!input) return 'Value is required';
    },
  });
  if (isCancel(value)) {
    console.log('\nCancelled.\n');
    process.exit(0);
  }
  return value;
}

export async function setAgentSecret(key, value) {
  if (!key) {
    console.error(`\n  ${ICON.fail} Usage: ${C.gold('harbinger set-agent-secret <KEY> [VALUE]')}`);
    console.error(`  Example: ${C.gold('harbinger set-agent-secret ANTHROPIC_API_KEY')}\n`);
    process.exit(1);
  }

  if (!value) value = await promptForValue(key);

  const { owner, repo } = loadRepoInfo();
  const prefixedName = `AGENT_${key}`;

  const { setSecret } = await import(path.join(packageDir, 'setup', 'lib', 'github.mjs'));
  const { updateEnvVariable } = await import(path.join(packageDir, 'setup', 'lib', 'auth.mjs'));

  const result = await setSecret(owner, repo, prefixedName, value);
  if (result.success) {
    console.log(`\n  ${ICON.ok} Set GitHub secret: ${C.gold(prefixedName)}`);
    updateEnvVariable(key, value);
    console.log(`  ${ICON.ok} Updated .env: ${C.gold(key)}\n`);
  } else {
    console.error(`\n  ${ICON.fail} Failed to set ${prefixedName}: ${result.error}\n`);
    process.exit(1);
  }
}

export async function setAgentLlmSecret(key, value) {
  if (!key) {
    console.error(`\n  ${ICON.fail} Usage: ${C.gold('harbinger set-agent-llm-secret <KEY> [VALUE]')}`);
    console.error(`  Example: ${C.gold('harbinger set-agent-llm-secret BRAVE_API_KEY')}\n`);
    process.exit(1);
  }

  if (!value) value = await promptForValue(key);

  const { owner, repo } = loadRepoInfo();
  const prefixedName = `AGENT_LLM_${key}`;

  const { setSecret } = await import(path.join(packageDir, 'setup', 'lib', 'github.mjs'));

  const result = await setSecret(owner, repo, prefixedName, value);
  if (result.success) {
    console.log(`\n  ${ICON.ok} Set GitHub secret: ${C.gold(prefixedName)}\n`);
  } else {
    console.error(`\n  ${ICON.fail} Failed to set ${prefixedName}: ${result.error}\n`);
    process.exit(1);
  }
}

export async function setVar(key, value) {
  if (!key) {
    console.error(`\n  ${ICON.fail} Usage: ${C.gold('harbinger set-var <KEY> [VALUE]')}`);
    console.error(`  Example: ${C.gold('harbinger set-var LLM_MODEL claude-sonnet-4-5-20250929')}\n`);
    process.exit(1);
  }

  if (!value) value = await promptForValue(key);

  const { owner, repo } = loadRepoInfo();

  const { setVariable } = await import(path.join(packageDir, 'setup', 'lib', 'github.mjs'));

  const result = await setVariable(owner, repo, key, value);
  if (result.success) {
    console.log(`\n  ${ICON.ok} Set GitHub variable: ${C.gold(key)}\n`);
  } else {
    console.error(`\n  ${ICON.fail} Failed to set ${key}: ${result.error}\n`);
    process.exit(1);
  }
}
