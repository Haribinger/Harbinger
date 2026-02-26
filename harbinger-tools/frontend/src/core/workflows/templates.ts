/**
 * Canonical workflow templates — single source of truth for Workflows page and workflow editor.
 * Both Workflows.tsx and useWorkflowEditorStore import from here.
 */

import type { WorkflowNode, WorkflowEdge, WorkflowConfig } from '../../types'

export type WorkflowTemplateIconKey = 'search' | 'shield' | 'target' | 'filetext'

export interface WorkflowTemplateData {
  id: string
  name: string
  description: string
  iconKey: WorkflowTemplateIconKey
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  config: WorkflowConfig
}

export const WORKFLOW_TEMPLATES: WorkflowTemplateData[] = [
  {
    id: 'recon-pipeline',
    name: 'Recon Pipeline',
    description: 'Full reconnaissance: subdomain enum, port scan, HTTP probing, screenshot capture',
    iconKey: 'search',
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
]
