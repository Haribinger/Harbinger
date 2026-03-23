// Bug Bounty Platform Data API
// Uses data from https://github.com/arkadiyt/bounty-targets-data (and custom GitHub sources)

const DEFAULT_DATA_SOURCE = 'https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/main/data'

export interface BugBountyProgram {
  name: string
  url: string
  platform: 'bugcrowd' | 'hackerone' | 'intigriti' | 'federacy' | 'yeswehack'
  domains: string[]
  wildcards: string[]
  targets: string[]
  maxBounty?: string
  responseTime?: string
  launchDate?: string
}

export interface BugBountyData {
  programs: BugBountyProgram[]
  domains: string[]
  wildcards: string[]
  lastUpdated: string
}

export interface DataSource {
  id: string
  name: string
  repoUrl: string  // e.g. "arkadiyt/bounty-targets-data"
  branch: string
  dataPath: string  // e.g. "data"
  enabled: boolean
  lastSynced: string | null
}

export const DEFAULT_DATA_SOURCES: DataSource[] = [
  {
    id: 'bounty-targets-data',
    name: 'Bounty Targets Data',
    repoUrl: 'arkadiyt/bounty-targets-data',
    branch: 'main',
    dataPath: 'data',
    enabled: true,
    lastSynced: null,
  },
]

// Build raw GitHub URL from a DataSource
function sourceBaseUrl(source: DataSource): string {
  return `https://raw.githubusercontent.com/${source.repoUrl}/${source.branch}/${source.dataPath}`
}

// Fetch raw data from a specific platform with timeout and size guard
interface RawScopeTarget {
  target?: string
  asset_identifier?: string  // HackerOne
  endpoint?: string          // Intigriti
}

interface RawPlatformEntry {
  name?: string
  url?: string
  handle?: string
  targets?: { in_scope?: RawScopeTarget[] }
  domains?: Array<{ name: string } | string>
  wildcards?: string[]
  max_reward?: string
  response_time?: string | number
  launch_date?: string
  start_date?: string
}

// Extract the actual target string from a scope entry — different platforms
// use different field names (target, asset_identifier, endpoint).
function extractTarget(entry: RawScopeTarget): string {
  return entry.target || entry.asset_identifier || entry.endpoint || ''
}

async function fetchPlatformData(platform: string, baseUrl = DEFAULT_DATA_SOURCE): Promise<RawPlatformEntry[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000) // 30s timeout
    const response = await fetch(`${baseUrl}/${platform}_data.json`, { signal: controller.signal })
    clearTimeout(timeout)
    if (!response.ok) throw new Error(`Failed to fetch ${platform} data: ${response.status}`)
    const data = await response.json()
    // Cap at 500 programs per platform to avoid memory issues
    return Array.isArray(data) ? data.slice(0, 500) : []
  } catch (error) {
    console.error(`Failed to fetch ${platform} data:`, error)
    return []
  }
}

// Fetch domains list
async function fetchDomains(baseUrl = DEFAULT_DATA_SOURCE): Promise<string[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    const response = await fetch(`${baseUrl}/domains.txt`, { signal: controller.signal })
    clearTimeout(timeout)
    if (!response.ok) throw new Error('Failed to fetch domains')
    const text = await response.text()
    return text.split('\n').filter(d => d.trim())
  } catch (error) {
    console.error('Failed to fetch domains:', error)
    return []
  }
}

// Fetch wildcards list
async function fetchWildcards(baseUrl = DEFAULT_DATA_SOURCE): Promise<string[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    const response = await fetch(`${baseUrl}/wildcards.txt`, { signal: controller.signal })
    clearTimeout(timeout)
    if (!response.ok) throw new Error('Failed to fetch wildcards')
    const text = await response.text()
    return text.split('\n').filter(w => w.trim())
  } catch (error) {
    console.error('Failed to fetch wildcards:', error)
    return []
  }
}

// Parse Bugcrowd data
function parseBugcrowdData(data: RawPlatformEntry[]): BugBountyProgram[] {
  return data.map((item) => {
    const scopeTargets = (item.targets?.in_scope || []).map(extractTarget).filter(Boolean)
    return {
      name: item.name || 'Unknown',
      url: item.url || '',
      platform: 'bugcrowd' as const,
      domains: scopeTargets.filter((t) => !t.includes('*')),
      wildcards: scopeTargets.filter((t) => t.includes('*')),
      targets: scopeTargets,
      maxBounty: item.max_reward,
      responseTime: item.response_time?.toString(),
      launchDate: item.launch_date,
    }
  })
}

// Parse HackerOne data
function parseHackerOneData(data: RawPlatformEntry[]): BugBountyProgram[] {
  return data.map((item) => {
    const scopeTargets = (item.targets?.in_scope || []).map(extractTarget).filter(Boolean)
    return {
      name: item.name || 'Unknown',
      url: item.url ? item.url : `https://hackerone.com/${item.handle}`,
      platform: 'hackerone' as const,
      domains: scopeTargets.filter((t) => !t.includes('*')),
      wildcards: scopeTargets.filter((t) => t.includes('*')),
      targets: scopeTargets,
      responseTime: item.response_time?.toString(),
      launchDate: item.start_date,
    }
  })
}

// Parse Intigriti data — uses targets.in_scope (like others) or top-level domains
function parseIntigritiData(data: RawPlatformEntry[]): BugBountyProgram[] {
  return data.map((item) => {
    // Intigriti may have targets.in_scope (with endpoint field) or top-level domains
    let scopeTargets: string[]
    if (item.targets?.in_scope?.length) {
      scopeTargets = item.targets.in_scope.map(extractTarget).filter(Boolean)
    } else {
      scopeTargets = (item.domains as Array<{ name: string }> | undefined)?.map((d) => d.name).filter(Boolean) || []
    }
    return {
      name: item.name || 'Unknown',
      url: item.url || '',
      platform: 'intigriti' as const,
      domains: scopeTargets.filter((d) => !d.includes('*')),
      wildcards: scopeTargets.filter((d) => d.includes('*')),
      targets: scopeTargets,
    }
  })
}

// Parse other platform data (Federacy, YesWeHack)
function parseGenericData(data: RawPlatformEntry[], platform: BugBountyProgram['platform']): BugBountyProgram[] {
  return data.map((item) => {
    // Try targets.in_scope first, fall back to top-level domains
    let rawTargets: string[]
    if (item.targets?.in_scope?.length) {
      rawTargets = item.targets.in_scope.map(extractTarget).filter(Boolean)
    } else {
      rawTargets = (item.domains || []).map((d) => typeof d === 'string' ? d : d.name).filter(Boolean)
    }
    return {
      name: item.name || 'Unknown',
      url: item.url || '',
      platform,
      domains: rawTargets.filter((d) => !d.includes('*')),
      wildcards: rawTargets.filter((d) => d.includes('*')),
      targets: rawTargets,
    }
  })
}

// Main API
export const bugBountyDataApi = {
  // Fetch all bug bounty data from a specific source
  fetchAll: async (sources?: DataSource[]): Promise<BugBountyData> => {
    const activeSources = (sources || DEFAULT_DATA_SOURCES).filter(s => s.enabled)
    const allPrograms: BugBountyProgram[] = []
    let allDomains: string[] = []
    let allWildcards: string[] = []

    for (const source of activeSources) {
      const baseUrl = sourceBaseUrl(source)
      // Fetch platforms in parallel per source, with individual error handling
      const [
        bugcrowdData,
        hackeroneData,
        intigritiData,
        federacyData,
        yeswehackData,
        domains,
        wildcards,
      ] = await Promise.all([
        fetchPlatformData('bugcrowd', baseUrl),
        fetchPlatformData('hackerone', baseUrl),
        fetchPlatformData('intigriti', baseUrl),
        fetchPlatformData('federacy', baseUrl),
        fetchPlatformData('yeswehack', baseUrl),
        fetchDomains(baseUrl),
        fetchWildcards(baseUrl),
      ])

      allPrograms.push(
        ...parseBugcrowdData(bugcrowdData),
        ...parseHackerOneData(hackeroneData),
        ...parseIntigritiData(intigritiData),
        ...parseGenericData(federacyData, 'federacy'),
        ...parseGenericData(yeswehackData, 'yeswehack'),
      )
      allDomains = [...allDomains, ...domains]
      allWildcards = [...allWildcards, ...wildcards]
    }

    return {
      programs: allPrograms,
      domains: [...new Set(allDomains)], // deduplicate
      wildcards: [...new Set(allWildcards)],
      lastUpdated: new Date().toISOString(),
    }
  },

  // Fetch programs by platform
  fetchByPlatform: async (platform: BugBountyProgram['platform'], baseUrl?: string): Promise<BugBountyProgram[]> => {
    const data = await fetchPlatformData(platform, baseUrl)
    switch (platform) {
      case 'bugcrowd': return parseBugcrowdData(data)
      case 'hackerone': return parseHackerOneData(data)
      case 'intigriti': return parseIntigritiData(data)
      default: return parseGenericData(data, platform)
    }
  },

  // Search across cached programs
  search: async (query: string, programs: BugBountyProgram[]): Promise<BugBountyProgram[]> => {
    const lowerQuery = query.toLowerCase()
    return programs.filter((p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.domains.some((d) => d.toLowerCase().includes(lowerQuery)) ||
      p.targets.some((t) => t.toLowerCase().includes(lowerQuery))
    )
  },

  // Export domains to file
  exportDomains: (domains: string[]): Blob => {
    return new Blob([domains.join('\n')], { type: 'text/plain' })
  },

  // Export wildcards to file
  exportWildcards: (wildcards: string[]): Blob => {
    return new Blob([wildcards.join('\n')], { type: 'text/plain' })
  },
}

export default bugBountyDataApi
