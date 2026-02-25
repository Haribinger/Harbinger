// Bug Bounty Platform Data API
// Uses data from https://github.com/arkadiyt/bounty-targets-data

const BOUNTY_TARGETS_DATA_URL = 'https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/main/data'

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

// Fetch raw data from a specific platform
async function fetchPlatformData(platform: string): Promise<any[]> {
  try {
    const response = await fetch(`${BOUNTY_TARGETS_DATA_URL}/${platform}_data.json`)
    if (!response.ok) throw new Error(`Failed to fetch ${platform} data`)
    return await response.json()
  } catch (error) {
    console.error(`Failed to fetch ${platform} data:`, error)
    return []
  }
}

// Fetch domains list
async function fetchDomains(): Promise<string[]> {
  try {
    const response = await fetch(`${BOUNTY_TARGETS_DATA_URL}/domains.txt`)
    if (!response.ok) throw new Error('Failed to fetch domains')
    const text = await response.text()
    return text.split('\n').filter(d => d.trim())
  } catch (error) {
    console.error('Failed to fetch domains:', error)
    return []
  }
}

// Fetch wildcards list
async function fetchWildcards(): Promise<string[]> {
  try {
    const response = await fetch(`${BOUNTY_TARGETS_DATA_URL}/wildcards.txt`)
    if (!response.ok) throw new Error('Failed to fetch wildcards')
    const text = await response.text()
    return text.split('\n').filter(w => w.trim())
  } catch (error) {
    console.error('Failed to fetch wildcards:', error)
    return []
  }
}

// Parse Bugcrowd data
function parseBugcrowdData(data: any[]): BugBountyProgram[] {
  return data.map((item) => ({
    name: item.name || 'Unknown',
    url: item.url || '',
    platform: 'bugcrowd',
    domains: item.targets?.in_scope?.map((t: any) => t.target).filter((t: string) => !t.includes('*')) || [],
    wildcards: item.targets?.in_scope?.map((t: any) => t.target).filter((t: string) => t.includes('*')) || [],
    targets: item.targets?.in_scope?.map((t: any) => t.target) || [],
    maxBounty: item.max_reward,
    responseTime: item.response_time,
    launchDate: item.launch_date,
  }))
}

// Parse HackerOne data
function parseHackerOneData(data: any[]): BugBountyProgram[] {
  return data.map((item) => ({
    name: item.name || 'Unknown',
    url: `https://hackerone.com/${item.handle}`,
    platform: 'hackerone',
    domains: item.targets?.in_scope?.map((t: any) => t.target).filter((t: string) => !t.includes('*')) || [],
    wildcards: item.targets?.in_scope?.map((t: any) => t.target).filter((t: string) => t.includes('*')) || [],
    targets: item.targets?.in_scope?.map((t: any) => t.target) || [],
    responseTime: item.response_time?.toString(),
    launchDate: item.start_date,
  }))
}

// Parse Intigriti data
function parseIntigritiData(data: any[]): BugBountyProgram[] {
  return data.map((item) => ({
    name: item.name || 'Unknown',
    url: item.url || '',
    platform: 'intigriti',
    domains: item.domains?.map((d: any) => d.name).filter((d: string) => !d.includes('*')) || [],
    wildcards: item.domains?.map((d: any) => d.name).filter((d: string) => d.includes('*')) || [],
    targets: item.domains?.map((d: any) => d.name) || [],
  }))
}

// Parse other platform data (Federacy, YesWeHack)
function parseGenericData(data: any[], platform: BugBountyProgram['platform']): BugBountyProgram[] {
  return data.map((item) => ({
    name: item.name || 'Unknown',
    url: item.url || '',
    platform,
    domains: item.domains || [],
    wildcards: item.wildcards || [],
    targets: [...(item.domains || []), ...(item.wildcards || [])],
  }))
}

// Main API
export const bugBountyDataApi = {
  // Fetch all bug bounty data
  fetchAll: async (): Promise<BugBountyData> => {
    const [
      bugcrowdData,
      hackeroneData,
      intigritiData,
      federacyData,
      yeswehackData,
      domains,
      wildcards,
    ] = await Promise.all([
      fetchPlatformData('bugcrowd'),
      fetchPlatformData('hackerone'),
      fetchPlatformData('intigriti'),
      fetchPlatformData('federacy'),
      fetchPlatformData('yeswehack'),
      fetchDomains(),
      fetchWildcards(),
    ])

    const programs = [
      ...parseBugcrowdData(bugcrowdData),
      ...parseHackerOneData(hackeroneData),
      ...parseIntigritiData(intigritiData),
      ...parseGenericData(federacyData, 'federacy'),
      ...parseGenericData(yeswehackData, 'yeswehack'),
    ]

    return {
      programs,
      domains,
      wildcards,
      lastUpdated: new Date().toISOString(),
    }
  },

  // Fetch programs by platform
  fetchByPlatform: async (platform: BugBountyProgram['platform']): Promise<BugBountyProgram[]> => {
    const data = await fetchPlatformData(platform)
    switch (platform) {
      case 'bugcrowd': return parseBugcrowdData(data)
      case 'hackerone': return parseHackerOneData(data)
      case 'intigriti': return parseIntigritiData(data)
      default: return parseGenericData(data, platform)
    }
  },

  // Search programs
  search: async (query: string): Promise<BugBountyProgram[]> => {
    const { programs } = await bugBountyDataApi.fetchAll()
    const lowerQuery = query.toLowerCase()
    return programs.filter((p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.domains.some((d) => d.toLowerCase().includes(lowerQuery)) ||
      p.targets.some((t) => t.toLowerCase().includes(lowerQuery))
    )
  },

  // Get domains for a program
  getProgramDomains: async (programName: string): Promise<string[]> => {
    const { programs } = await bugBountyDataApi.fetchAll()
    const program = programs.find((p) => p.name === programName)
    return program?.domains || []
  },

  // Get wildcards for a program
  getProgramWildcards: async (programName: string): Promise<string[]> => {
    const { programs } = await bugBountyDataApi.fetchAll()
    const program = programs.find((p) => p.name === programName)
    return program?.wildcards || []
  },

  // Export domains to file
  exportDomains: async (): Promise<Blob> => {
    const { domains } = await bugBountyDataApi.fetchAll()
    const text = domains.join('\n')
    return new Blob([text], { type: 'text/plain' })
  },

  // Export wildcards to file
  exportWildcards: async (): Promise<Blob> => {
    const { wildcards } = await bugBountyDataApi.fetchAll()
    const text = wildcards.join('\n')
    return new Blob([text], { type: 'text/plain' })
  },
}

export default bugBountyDataApi
