/**
 * Canonical workflow templates — single source of truth for Workflows page and workflow editor.
 * Both Workflows.tsx and useWorkflowEditorStore import from here.
 */

import type { WorkflowNode, WorkflowEdge, WorkflowConfig } from '../../types'

export type WorkflowTemplateIconKey = 'search' | 'shield' | 'target' | 'filetext' | 'globe' | 'clock' | 'code' | 'bell'

export type WorkflowTemplateDifficulty = 'beginner' | 'intermediate' | 'advanced'

export interface WorkflowTemplateData {
  id: string
  name: string
  description: string
  iconKey: WorkflowTemplateIconKey
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  config: WorkflowConfig
  category?: string
  author?: string
  difficulty?: WorkflowTemplateDifficulty
  tags?: string[]
}

export const WORKFLOW_TEMPLATES: WorkflowTemplateData[] = [
  {
    id: 'recon-pipeline',
    name: 'Recon Pipeline',
    description: 'Full reconnaissance: subdomain enum, port scan, HTTP probing, screenshot capture',
    iconKey: 'search',
    category: 'recon',
    author: 'Harbinger',
    difficulty: 'beginner',
    tags: ['recon', 'subdomain', 'port-scan', 'http'],
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 200 }, data: { label: 'Target Input', trigger: 'manual', input: 'domain' } },
      { id: 'n2', type: 'agent', position: { x: 300, y: 100 }, data: { label: 'Subdomain Enum', agent: 'pathfinder', tool: 'subfinder', args: '-d ${domain} -silent' } },
      { id: 'n3', type: 'agent', position: { x: 300, y: 300 }, data: { label: 'DNS Resolve', agent: 'pathfinder', tool: 'dnsx', args: '-l ${subdomains} -resp -a' } },
      { id: 'n4', type: 'agent', position: { x: 550, y: 100 }, data: { label: 'Port Scan', agent: 'pathfinder', tool: 'naabu', args: '-l ${live_hosts} -top-ports 1000' } },
      { id: 'n5', type: 'agent', position: { x: 550, y: 300 }, data: { label: 'HTTP Probe', agent: 'pathfinder', tool: 'httpx', args: '-l ${live_hosts} -sc -td -title' } },
      { id: 'n6', type: 'agent', position: { x: 800, y: 200 }, data: { label: 'Screenshot', agent: 'lens', tool: 'screenshot', args: '-urls ${http_alive}' } },
      { id: 'n7', type: 'agent', position: { x: 1050, y: 200 }, data: { label: 'Generate Report', agent: 'scribe', tool: 'markdown-report', args: '--template recon' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n1', target: 'n3', animated: true },
      { id: 'e3', source: 'n2', target: 'n4' },
      { id: 'e4', source: 'n3', target: 'n5' },
      { id: 'e5', source: 'n4', target: 'n6' },
      { id: 'e6', source: 'n5', target: 'n6' },
      { id: 'e7', source: 'n6', target: 'n7' },
    ],
    config: { autoStart: false, retryOnError: true, maxRetries: 2, timeout: 7200, parallelExecution: true },
  },
  {
    id: 'vuln-scan',
    name: 'Vulnerability Scanner',
    description: 'Nuclei templates + custom checks against discovered endpoints',
    iconKey: 'shield',
    category: 'offensive',
    author: 'Harbinger',
    difficulty: 'intermediate',
    tags: ['vuln', 'nuclei', 'xss', 'sqli', 'scan'],
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 200 }, data: { label: 'URL List Input', trigger: 'manual', input: 'urls_file' } },
      { id: 'n2', type: 'agent', position: { x: 300, y: 100 }, data: { label: 'Nuclei Scan', agent: 'breach', tool: 'nuclei', args: '-l ${urls_file} -severity critical,high,medium -o findings.json -jsonl' } },
      { id: 'n3', type: 'agent', position: { x: 300, y: 300 }, data: { label: 'Directory Fuzz', agent: 'breach', tool: 'ffuf', args: '-u ${base_url}/FUZZ -w /wordlists/common.txt -mc 200,301,403' } },
      { id: 'n4', type: 'agent', position: { x: 550, y: 100 }, data: { label: 'XSS Check', agent: 'breach', tool: 'dalfox', args: '-b ${urls_file} --skip-bav' } },
      { id: 'n5', type: 'agent', position: { x: 550, y: 300 }, data: { label: 'SQLi Check', agent: 'breach', tool: 'sqlmap', args: '-m ${urls_file} --batch --level 3 --risk 2' } },
      { id: 'n6', type: 'agent', position: { x: 800, y: 200 }, data: { label: 'Deduplicate Findings', agent: 'scribe', tool: 'dedup', args: '--input findings/' } },
      { id: 'n7', type: 'agent', position: { x: 1050, y: 200 }, data: { label: 'Write Report', agent: 'scribe', tool: 'markdown-report', args: '--template vuln-assessment' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n1', target: 'n3', animated: true },
      { id: 'e3', source: 'n2', target: 'n4' },
      { id: 'e4', source: 'n2', target: 'n5' },
      { id: 'e5', source: 'n3', target: 'n6' },
      { id: 'e6', source: 'n4', target: 'n6' },
      { id: 'e7', source: 'n5', target: 'n6' },
      { id: 'e8', source: 'n6', target: 'n7' },
    ],
    config: { autoStart: false, retryOnError: true, maxRetries: 3, timeout: 14400, parallelExecution: true },
  },
  {
    id: 'bug-bounty-full',
    name: 'Bug Bounty Pipeline',
    description: 'End-to-end: recon, enumerate, scan, exploit, report — full automated bounty workflow',
    iconKey: 'target',
    category: 'bounty',
    author: 'Harbinger',
    difficulty: 'advanced',
    tags: ['bounty', 'full-pipeline', 'hackerone', 'bugcrowd'],
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 200 }, data: { label: 'Program Scope', trigger: 'manual', input: 'scope_domains' } },
      { id: 'n2', type: 'agent', position: { x: 250, y: 200 }, data: { label: 'PATHFINDER Recon', agent: 'pathfinder', tool: 'full-recon', args: '-scope ${scope_domains}' } },
      { id: 'n3', type: 'agent', position: { x: 450, y: 100 }, data: { label: 'SPECTER OSINT', agent: 'specter', tool: 'osint-gather', args: '-targets ${recon_output}' } },
      { id: 'n4', type: 'agent', position: { x: 450, y: 300 }, data: { label: 'BREACH Scan', agent: 'breach', tool: 'vuln-scan', args: '-urls ${http_alive} -severity high,critical' } },
      { id: 'n5', type: 'agent', position: { x: 650, y: 100 }, data: { label: 'PHANTOM Cloud Check', agent: 'phantom', tool: 'cloud-enum', args: '-domains ${subdomains}' } },
      { id: 'n6', type: 'agent', position: { x: 650, y: 300 }, data: { label: 'LENS Visual Verify', agent: 'lens', tool: 'screenshot-verify', args: '-findings ${vuln_findings}' } },
      { id: 'n7', type: 'agent', position: { x: 850, y: 200 }, data: { label: 'Triage & Dedupe', agent: 'scribe', tool: 'triage', args: '-all-findings ${findings_dir}' } },
      { id: 'n8', type: 'agent', position: { x: 1050, y: 200 }, data: { label: 'SCRIBE Report', agent: 'scribe', tool: 'bounty-report', args: '--platform hackerone --template professional' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n2', target: 'n4' },
      { id: 'e4', source: 'n3', target: 'n5' },
      { id: 'e5', source: 'n4', target: 'n6' },
      { id: 'e6', source: 'n5', target: 'n7' },
      { id: 'e7', source: 'n6', target: 'n7' },
      { id: 'e8', source: 'n7', target: 'n8' },
    ],
    config: { autoStart: false, retryOnError: true, maxRetries: 2, timeout: 28800, parallelExecution: true },
  },
  {
    id: 'report-gen',
    name: 'Report Generator',
    description: 'Collect findings from agents, deduplicate, score by CVSS, generate formatted report',
    iconKey: 'filetext',
    category: 'reporting',
    author: 'Harbinger',
    difficulty: 'beginner',
    tags: ['report', 'cvss', 'pdf', 'findings'],
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 200 }, data: { label: 'Findings Input', trigger: 'manual', input: 'findings_dir' } },
      { id: 'n2', type: 'script', position: { x: 300, y: 200 }, data: { label: 'Parse Findings', script: 'parse-findings.sh', args: '${findings_dir}' } },
      { id: 'n3', type: 'script', position: { x: 550, y: 100 }, data: { label: 'CVSS Scoring', script: 'cvss-score.py', args: '--input ${parsed_findings}' } },
      { id: 'n4', type: 'script', position: { x: 550, y: 300 }, data: { label: 'Dedup & Merge', script: 'dedup-findings.sh', args: '--input ${parsed_findings}' } },
      { id: 'n5', type: 'agent', position: { x: 800, y: 200 }, data: { label: 'SCRIBE Narrative', agent: 'scribe', tool: 'narrative-gen', args: '--findings ${scored_findings}' } },
      { id: 'n6', type: 'agent', position: { x: 1050, y: 200 }, data: { label: 'Export PDF', agent: 'scribe', tool: 'pdf-export', args: '--report ${narrative} --format professional' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n2', target: 'n4' },
      { id: 'e4', source: 'n3', target: 'n5' },
      { id: 'e5', source: 'n4', target: 'n5' },
      { id: 'e6', source: 'n5', target: 'n6' },
    ],
    config: { autoStart: false, retryOnError: false, maxRetries: 1, timeout: 3600, parallelExecution: false },
  },
  {
    id: 'api-security-scan',
    name: 'API Security Scan',
    description: 'HTTP request to API endpoint, run nuclei checks, decision on severity, notify on critical',
    iconKey: 'globe',
    category: 'offensive',
    author: 'Harbinger',
    difficulty: 'intermediate',
    tags: ['api', 'http', 'nuclei', 'notification'],
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 200 }, data: { label: 'API Target', trigger: 'manual', input: 'api_url' } },
      { id: 'n2', type: 'agent', position: { x: 300, y: 200 }, data: { label: 'HTTP Probe', agent: 'breach', tool: 'httpx', args: '-u ${api_url} -sc -td -title' } },
      { id: 'n3', type: 'agent', position: { x: 550, y: 200 }, data: { label: 'Nuclei API Scan', agent: 'breach', tool: 'nuclei', args: '-u ${api_url} -t api/ -severity critical,high' } },
      { id: 'n4', type: 'script', position: { x: 800, y: 200 }, data: { label: 'Severity Check', condition: '{{prev.output}} contains "critical"', trueLabel: 'Critical', falseLabel: 'Low' } },
      { id: 'n5', type: 'agent', position: { x: 1050, y: 100 }, data: { label: 'Alert: Critical', channel: 'discord', messageTemplate: 'CRITICAL: {{prev.output}}', severity: 'critical' } },
      { id: 'n6', type: 'agent', position: { x: 1050, y: 300 }, data: { label: 'Save Report', agent: 'scribe', tool: 'markdown-report', args: '--template api-scan' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
      { id: 'e5', source: 'n4', target: 'n6' },
    ],
    config: { autoStart: false, retryOnError: true, maxRetries: 2, timeout: 7200, parallelExecution: false },
  },
  {
    id: 'scheduled-recon',
    name: 'Scheduled Recon',
    description: 'Cron-triggered recon: loop over targets, run subfinder with delay between each, generate report',
    iconKey: 'clock',
    category: 'recon',
    author: 'Harbinger',
    difficulty: 'intermediate',
    tags: ['cron', 'loop', 'recon', 'delay', 'scheduled'],
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 200 }, data: { label: 'Cron: Every 6h', trigger: 'cron', cronExpression: '0 */6 * * *', input: 'target_list' } },
      { id: 'n2', type: 'script', position: { x: 300, y: 200 }, data: { label: 'Loop Targets', iteratorExpression: '{{trigger.data.targets}}', itemVariable: 'target', maxIterations: 50 } },
      { id: 'n3', type: 'agent', position: { x: 550, y: 200 }, data: { label: 'Subfinder', agent: 'pathfinder', tool: 'subfinder', args: '-d {{item}} -silent' } },
      { id: 'n4', type: 'script', position: { x: 750, y: 200 }, data: { label: 'Rate Limit', delayType: 'fixed', durationMs: 5000 } },
      { id: 'n5', type: 'agent', position: { x: 950, y: 200 }, data: { label: 'Generate Report', agent: 'scribe', tool: 'markdown-report', args: '--template recon-batch' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
    config: { autoStart: false, retryOnError: true, maxRetries: 1, timeout: 14400, parallelExecution: false },
  },
  {
    id: 'cve-rapid-response',
    name: 'CVE Rapid Response',
    description: 'Webhook trigger on new CVE, parse with code node, dispatch agent scan, notify team',
    iconKey: 'bell',
    category: 'defensive',
    author: 'Harbinger',
    difficulty: 'advanced',
    tags: ['cve', 'webhook', 'code', 'notification', 'rapid-response'],
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 200 }, data: { label: 'CVE Webhook', trigger: 'webhook', webhookPath: '/webhooks/cve-alert', input: 'cve_data' } },
      { id: 'n2', type: 'script', position: { x: 300, y: 200 }, data: { label: 'Parse CVE', language: 'javascript', code: 'const cve = input.cve;\nreturn { id: cve.id, severity: cve.severity, affected: cve.products };' } },
      { id: 'n3', type: 'agent', position: { x: 550, y: 200 }, data: { label: 'BREACH Scan', agent: 'breach', tool: 'nuclei', args: '-t cves/${cve_id}.yaml -l scope_targets.txt' } },
      { id: 'n4', type: 'script', position: { x: 800, y: 200 }, data: { label: 'Impact Check', condition: '{{prev.output}} contains "vulnerable"', trueLabel: 'Affected', falseLabel: 'Safe' } },
      { id: 'n5', type: 'agent', position: { x: 1050, y: 100 }, data: { label: 'Alert Team', channel: 'slack', messageTemplate: 'VULN CONFIRMED: {{prev.output}}', severity: 'critical' } },
      { id: 'n6', type: 'agent', position: { x: 1050, y: 300 }, data: { label: 'Log Result', agent: 'scribe', tool: 'save', args: '--output ./cve-responses/' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
      { id: 'e5', source: 'n4', target: 'n6' },
    ],
    config: { autoStart: false, retryOnError: true, maxRetries: 3, timeout: 3600, parallelExecution: false },
  },
  {
    id: 'evidence-collection',
    name: 'Evidence Collection',
    description: 'Trigger on finding, screenshot with browser, loop through endpoints, save evidence package',
    iconKey: 'target',
    category: 'reporting',
    author: 'Harbinger',
    difficulty: 'intermediate',
    tags: ['evidence', 'browser', 'screenshot', 'loop', 'reporting'],
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 50, y: 200 }, data: { label: 'On Finding', trigger: 'on-finding', eventFilter: 'finding.high,finding.critical', input: 'finding_data' } },
      { id: 'n2', type: 'script', position: { x: 300, y: 200 }, data: { label: 'Loop URLs', iteratorExpression: '{{trigger.data.urls}}', itemVariable: 'url', maxIterations: 20 } },
      { id: 'n3', type: 'agent', position: { x: 550, y: 200 }, data: { label: 'LENS Screenshot', agent: 'lens', tool: 'screenshot', args: '-url {{item}} --full-page' } },
      { id: 'n4', type: 'script', position: { x: 750, y: 200 }, data: { label: 'Delay 2s', delayType: 'fixed', durationMs: 2000 } },
      { id: 'n5', type: 'agent', position: { x: 950, y: 200 }, data: { label: 'Save Evidence', agent: 'scribe', tool: 'save', args: '--output ./evidence/{{workflow.name}}/' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
    config: { autoStart: false, retryOnError: false, maxRetries: 1, timeout: 3600, parallelExecution: false },
  },
]
