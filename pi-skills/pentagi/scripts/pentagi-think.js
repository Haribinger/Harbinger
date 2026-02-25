#!/usr/bin/env node
/**
 * PentAGI Think — consults the PentAGI autonomous pentesting brain for next-step decisions.
 * PentAGI analyzes current context and recommends the next action in a pentest engagement.
 *
 * Usage: node pentagi-think.js "<context or observation>"
 * Example: node pentagi-think.js "Found open port 8080 on target.com running Tomcat 9.0.37"
 */

const PENTAGI_URL = process.env.PENTAGI_API_URL || 'http://pentagi:3002'
const TIMEOUT_MS = parseInt(process.env.PENTAGI_TIMEOUT || '60000', 10)

import { execSync } from 'child_process'

const observation = process.argv.slice(2).join(' ')

if (!observation) {
  console.error('Usage: pentagi-think.js "<observation or current context>"')
  console.error('Example: pentagi-think.js "Found port 8080 running Apache Tomcat 9.0.37"')
  process.exit(1)
}

const payload = JSON.stringify({
  observation,
  timestamp: new Date().toISOString(),
  // Pass environment context so PentAGI can factor in what tools are available
  available_tools: [
    'nuclei', 'sqlmap', 'dalfox', 'ffuf', 'subfinder', 'httpx',
    'naabu', 'nmap', 'dnsx', 'katana', 'gau', 'waybackurls',
    'theharvester', 'amass', 'dirsearch', 'feroxbuster'
  ]
})

console.log(`[pentagi] analyzing: ${observation.slice(0, 80)}${observation.length > 80 ? '...' : ''}`)

try {
  const result = execSync(
    `curl -sf -X POST \
      -H "Content-Type: application/json" \
      -d '${payload.replace(/'/g, "'\\''")}' \
      --max-time ${TIMEOUT_MS / 1000} \
      ${PENTAGI_URL}/think`,
    { encoding: 'utf8', timeout: TIMEOUT_MS }
  )

  let parsed
  try {
    parsed = JSON.parse(result)
  } catch {
    console.log(result)
    process.exit(0)
  }

  if (parsed.error) {
    console.error(`[pentagi] error: ${parsed.error}`)
    process.exit(1)
  }

  // PentAGI returns: { recommendation, confidence, next_steps, rationale }
  if (parsed.recommendation) {
    console.log(`\n[pentagi] RECOMMENDATION (${parsed.confidence ?? '?'}% confidence):`)
    console.log(parsed.recommendation)

    if (parsed.next_steps?.length) {
      console.log('\n[pentagi] NEXT STEPS:')
      parsed.next_steps.forEach((step, i) => console.log(`  ${i + 1}. ${step}`))
    }

    if (parsed.rationale) {
      console.log(`\n[pentagi] RATIONALE: ${parsed.rationale}`)
    }
  } else {
    console.log(JSON.stringify(parsed, null, 2))
  }

} catch (err) {
  if (err.status === 22) {
    console.error(`[pentagi] container unreachable at ${PENTAGI_URL}`)
    console.error('Is the pentagi container running? Check: docker ps | grep pentagi')
  } else {
    console.error(`[pentagi] call failed: ${err.message}`)
  }
  process.exit(1)
}
