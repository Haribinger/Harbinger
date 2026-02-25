#!/usr/bin/env node
/**
 * HexStrike Bridge — proxies tool calls from the agent to the HexStrike MCP container.
 * The agent calls this script; this calls the HexStrike HTTP API.
 *
 * Usage: node hexstrike-call.js <tool> [args...]
 * Example: node hexstrike-call.js nuclei -u https://target.com -t cves/
 */

import { execSync } from 'child_process'

const HEXSTRIKE_URL = process.env.HEXSTRIKE_API_URL || 'http://hexstrike:3001'
const TIMEOUT_MS = parseInt(process.env.HEXSTRIKE_TIMEOUT || '120000', 10)

const tool = process.argv[2]
const args = process.argv.slice(3)

if (!tool) {
  console.error('Usage: hexstrike-call.js <tool> [args...]')
  console.error('Example: hexstrike-call.js nuclei -u https://target.com -t cves/')
  process.exit(1)
}

const payload = JSON.stringify({ tool, args })

console.log(`[hexstrike] → ${tool} ${args.join(' ')}`)
console.log(`[hexstrike] endpoint: ${HEXSTRIKE_URL}/execute`)

try {
  // Make the actual HTTP call to the HexStrike MCP container
  const result = execSync(
    `curl -sf -X POST \
      -H "Content-Type: application/json" \
      -d '${payload.replace(/'/g, "'\\''")}' \
      --max-time ${TIMEOUT_MS / 1000} \
      ${HEXSTRIKE_URL}/execute`,
    { encoding: 'utf8', timeout: TIMEOUT_MS }
  )

  let parsed
  try {
    parsed = JSON.parse(result)
  } catch {
    // Raw output — just print it
    console.log(result)
    process.exit(0)
  }

  if (parsed.error) {
    console.error(`[hexstrike] error: ${parsed.error}`)
    process.exit(1)
  }

  if (parsed.output) {
    console.log(parsed.output)
  } else {
    console.log(JSON.stringify(parsed, null, 2))
  }

} catch (err) {
  if (err.status === 22) {
    console.error(`[hexstrike] tool not found or container unreachable: ${HEXSTRIKE_URL}`)
    console.error('Is the hexstrike container running? Check: docker ps | grep hexstrike')
  } else {
    console.error(`[hexstrike] call failed: ${err.message}`)
  }
  process.exit(1)
}
