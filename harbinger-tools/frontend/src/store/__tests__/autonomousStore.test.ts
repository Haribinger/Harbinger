import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAutonomousStore } from '../autonomousStore'

// Mock the API module
vi.mock('../../api/autonomous', () => ({
  autonomousApi: {
    listThoughts: vi.fn().mockResolvedValue({
      thoughts: [
        { id: '1', agent_id: 'pathfinder', type: 'observation', title: 'Test', status: 'pending' },
        { id: '2', agent_id: 'breach', type: 'enhancement', title: 'Improve scan', status: 'pending' },
      ],
    }),
    getSwarmState: vi.fn().mockResolvedValue({
      swarm: { agents: [], total: 0 },
    }),
    getStats: vi.fn().mockResolvedValue({
      stats: { total_thoughts: 2, pending: 2, approved: 0, implemented: 0 },
    }),
    updateThought: vi.fn().mockResolvedValue({ ok: true }),
    deleteThought: vi.fn().mockResolvedValue({ ok: true }),
    createThought: vi.fn().mockResolvedValue({ ok: true, thought: { id: '3' } }),
  },
}))

describe('autonomousStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    const store = useAutonomousStore.getState()
    useAutonomousStore.setState({
      thoughts: [],
      swarm: null,
      stats: null,
      isLoading: false,
      error: null,
      selectedAgent: '',
      selectedType: '',
      selectedStatus: '',
    })
    vi.clearAllMocks()
  })

  it('has correct initial state', () => {
    const state = useAutonomousStore.getState()
    expect(state.thoughts).toEqual([])
    expect(state.swarm).toBeNull()
    expect(state.stats).toBeNull()
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.selectedAgent).toBe('')
    expect(state.selectedType).toBe('')
    expect(state.selectedStatus).toBe('')
  })

  it('setFilter updates filter values', async () => {
    const { setFilter } = useAutonomousStore.getState()
    await setFilter('selectedAgent', 'pathfinder')
    expect(useAutonomousStore.getState().selectedAgent).toBe('pathfinder')
  })

  it('fetchThoughts populates thoughts array', async () => {
    const { fetchThoughts } = useAutonomousStore.getState()
    await fetchThoughts()
    const state = useAutonomousStore.getState()
    expect(state.thoughts).toHaveLength(2)
    expect(state.thoughts[0].id).toBe('1')
    expect(state.isLoading).toBe(false)
  })

  it('fetchSwarm populates swarm state', async () => {
    const { fetchSwarm } = useAutonomousStore.getState()
    await fetchSwarm()
    expect(useAutonomousStore.getState().swarm).toBeTruthy()
  })

  it('fetchStats populates stats', async () => {
    const { fetchStats } = useAutonomousStore.getState()
    await fetchStats()
    const stats = useAutonomousStore.getState().stats
    expect(stats).toBeTruthy()
    expect(stats?.total_thoughts).toBe(2)
  })

  it('approveThought updates thought status locally', async () => {
    // Pre-populate thoughts
    useAutonomousStore.setState({
      thoughts: [
        {
          id: '1',
          agent_id: 'test',
          agent_name: 'TEST',
          type: 'observation',
          category: 'performance',
          title: 'T',
          content: '',
          status: 'pending',
          priority: 3,
          created_at: Date.now(),
        },
      ],
    })

    const { approveThought } = useAutonomousStore.getState()
    await approveThought('1')
    expect(useAutonomousStore.getState().thoughts[0].status).toBe('approved')
  })

  it('deleteThought removes thought from array', async () => {
    useAutonomousStore.setState({
      thoughts: [
        {
          id: '1',
          agent_id: 'test',
          agent_name: 'TEST',
          type: 'observation',
          category: 'performance',
          title: 'T',
          content: '',
          status: 'pending',
          priority: 3,
          created_at: Date.now(),
        },
      ],
    })

    const { deleteThought } = useAutonomousStore.getState()
    await deleteThought('1')
    expect(useAutonomousStore.getState().thoughts).toHaveLength(0)
  })
})
