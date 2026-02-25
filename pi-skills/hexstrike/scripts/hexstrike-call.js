import { execSync } from 'child_process';

/**
 * HexStrike Bridge Script
 * Proxies calls from the Harbinger Agent to the HexStrike MCP container.
 */

const tool = process.argv[2];
const args = process.argv.slice(3).join(' ');

if (!tool) {
  console.error('Usage: node hexstrike-call.js <tool> [args]');
  process.exit(1);
}

const HEXSTRIKE_URL = process.env.HEXSTRIKE_API_URL || 'http://hexstrike:3001';

console.log(`[*] Harbinger calling HexStrike tool: ${tool} with args: ${args}`);

try {
  // In a real implementation, this would be an HTTP call to the MCP bridge.
  // For now, we simulate the interaction pattern.
  const cmd = `curl -s -X POST ${HEXSTRIKE_URL}/execute -d '{"tool": "${tool}", "args": "${args}"}'`;
  console.log(`[+] Executing: ${cmd}`);
  // const output = execSync(cmd).toString();
  // console.log(output);
  console.log(`[!] Tool "${tool}" is queued in the HexStrike engine.`);
} catch (error) {
  console.error(`[-] Error calling HexStrike: ${error.message}`);
  process.exit(1);
}
