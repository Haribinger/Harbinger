import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock apiClient before importing the store
vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue([
      { id: '1', name: 'Recon Scout', codename: 'PATHFINDER', type: 'recon-scout', status: 'idle', color: '#3b82f6' },
      { id: '2', name: 'Web Hacker', codename: 'BREACH', type: 'web-hacker', status: 'running', color: '#ef4444' },
    ]),
    post: vi.fn().mockResolvedValue({ ok: true }),
    put: vi.fn().mockResolvedValue({ ok: true }),
    delete: vi.fn().mockResolvedValue({ ok: true }),
  },
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { ok: true } }),
  },
}))

vi.mock('../../api/agents', () => ({
  agentsApi: {
    getAll: vi.fn().mockResolvedValue([
      {
        id: '1',
        name: 'Recon Scout',
        type: 'recon-scout',
        status: 'idle',
        capabilities: [],
      },
      {
        id: '2',
        name: 'Web Hacker',
        type: 'web-hacker',
        status: 'running',
        capabilities: [],
      },
    ]),
    spawn: vi.fn().mockResolvedValue({ ok: true, container_id: 'abc123' }),
    stop: vi.fn().mockResolvedValue({ ok: true }),
    heartbeat: vi.fn().mockResolvedValue({ ok: true }),
    create: vi.fn().mockResolvedValue({ id: '3', name: 'New Agent' }),
    getTemplates: vi.fn().mockResolvedValue({ ok: true, templates: [], count: 0 }),
  },
}))

// Dynamic import after mocks
const { useAgentStore } = await import('../agentStore')

describe('agentStore', () => {
  beforeEach(() => {
    useAgentStore.setState({
      agents: [],
      isLoading: false,
      error: null,
    })
    vi.clearAllMocks()
  })

  it('has correct initial state', () => {
    const state = useAgentStore.getState()
    expect(state.agents).toEqual([])
    expect(state.isLoading).toBe(false)
  })

  it('fetchAgents populates agents array', async () => {
    const { fetchAgents } = useAgentStore.getState()
    await fetchAgents()
    const state = useAgentStore.getState()
    expect(state.agents).toHaveLength(2)
    expect(state.agents[0].name).toBe('Recon Scout')
    expect(state.agents[1].name).toBe('Web Hacker')
  })
})
