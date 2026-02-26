/**
 * AutonomousEngine — Background thinking loop for Harbinger agents.
 *
 * Every agent runs this engine to continuously analyze context, identify
 * improvements, calculate efficiency, and propose automations. The engine
 * posts thoughts to the swarm API where operators can approve/reject them.
 *
 * COST_BENEFIT = (TIME_SAVED * FREQUENCY) / (IMPL_COST + RUNNING_COST)
 * Only proposals with cost_benefit > 1.0 get surfaced.
 */

class AutonomousEngine {
  constructor(opts = {}) {
    this.agentId = opts.agentId || 'unknown'
    this.agentName = opts.agentName || 'AGENT'
    this.agentType = opts.agentType || 'general'
    this.apiBase = opts.apiBase || process.env.HARBINGER_API || 'http://localhost:8080'
    this.interval = opts.interval || 60000 // 60-second thinking cycle
    this.token = opts.token || process.env.HARBINGER_TOKEN || ''
    this._timer = null
    this._running = false
    this._cycleCount = 0
    this._lastContext = null
  }

  // Start the autonomous thinking loop
  start() {
    if (this._running) return
    this._running = true
    console.log(`[${this.agentName}] Autonomous engine started (${this.interval / 1000}s cycle)`)

    // Run first cycle immediately, then on interval
    this._think()
    this._timer = setInterval(() => this._think(), this.interval)
  }

  // Stop the thinking loop
  stop() {
    this._running = false
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
    console.log(`[${this.agentName}] Autonomous engine stopped after ${this._cycleCount} cycles`)
  }

  // Core thinking cycle
  async _think() {
    this._cycleCount++
    try {
      // 1. Gather context — what's happening in the swarm?
      const context = await this._gatherContext()
      this._lastContext = context

      // 2. Identify enhancements — scan 5 dimensions
      const enhancements = this._identifyEnhancements(context)

      // 3. For each enhancement, calculate efficiency and classify
      for (const enhancement of enhancements) {
        const efficiency = this._calculateEfficiency(enhancement)

        // Only report if cost-benefit ratio is positive
        if (efficiency.cost_benefit >= 1.0) {
          enhancement.efficiency = efficiency
          enhancement.efficiency.automation_type = this._classifyAutomation(enhancement)
          await this._reportThought(enhancement)
        }
      }
    } catch (err) {
      // Silent fail — don't crash the agent over thinking errors
      if (this._cycleCount <= 3) {
        console.error(`[${this.agentName}] Think cycle error:`, err.message)
      }
    }
  }

  // Gather swarm context + own status
  async _gatherContext() {
    const headers = { 'Content-Type': 'application/json' }
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`

    try {
      const res = await fetch(`${this.apiBase}/api/agents/swarm`, { headers })
      if (!res.ok) return { swarm: null, self: null }
      const data = await res.json()
      const swarm = data.swarm || null
      const self = swarm?.agents?.find(a => a.id === this.agentId) || null
      return { swarm, self }
    } catch {
      return { swarm: null, self: null }
    }
  }

  // Scan 5 dimensions for potential enhancements
  _identifyEnhancements(context) {
    const enhancements = []
    const { swarm, self } = context

    // Dimension 1: Performance — detect bottlenecks and slow patterns
    if (self && self.thought_count > 50) {
      enhancements.push({
        type: 'enhancement',
        category: 'performance',
        title: `${this.agentName} generating high thought volume`,
        content: `Agent has ${self.thought_count} thoughts. Consider batch processing or reducing scan frequency.`,
        priority: 2,
      })
    }

    // Dimension 2: Accuracy — check for repeated patterns
    if (swarm && swarm.pending_proposals > 10) {
      enhancements.push({
        type: 'observation',
        category: 'accuracy',
        title: 'Unreviewed proposals accumulating',
        content: `${swarm.pending_proposals} proposals pending review. Backlog may indicate poor signal-to-noise ratio.`,
        priority: 3,
      })
    }

    // Dimension 3: Cost — identify expensive operations
    if (swarm && swarm.system_health === 'degraded') {
      enhancements.push({
        type: 'alert',
        category: 'cost',
        title: 'System health degraded',
        content: 'Swarm health is degraded. Consider throttling non-critical operations.',
        priority: 4,
      })
    }

    // Dimension 4: Automation — detect repetitive tasks
    if (self && self.status === 'idle') {
      enhancements.push({
        type: 'proposal',
        category: 'automation',
        title: `${this.agentName} idle — suggest proactive scan`,
        content: `Agent is idle. Could run a scheduled ${this.agentType} scan to find new targets.`,
        priority: 2,
      })
    }

    // Dimension 5: Collaboration — detect handoff opportunities
    if (swarm && swarm.agents) {
      const idleAgents = swarm.agents.filter(a => a.status === 'idle' && a.id !== this.agentId)
      if (idleAgents.length > 3) {
        enhancements.push({
          type: 'proposal',
          category: 'collaboration',
          title: 'Multiple agents idle — suggest coordinated sweep',
          content: `${idleAgents.length} agents idle: ${idleAgents.map(a => a.name).join(', ')}. Consider launching a coordinated assessment.`,
          priority: 3,
        })
      }
    }

    return enhancements
  }

  // Calculate cost-benefit ratio for an enhancement
  _calculateEfficiency(enhancement) {
    // Heuristic scoring based on category and priority
    const baseTimeSaved = { performance: 2, accuracy: 1, cost: 3, automation: 4, collaboration: 2 }
    const baseFrequency = { performance: 7, accuracy: 3, cost: 1, automation: 14, collaboration: 2 }
    const baseCost = { performance: 4, accuracy: 2, cost: 1, automation: 8, collaboration: 6 }

    const cat = enhancement.category || 'automation'
    const timeSaved = (baseTimeSaved[cat] || 1) * (enhancement.priority / 3)
    const frequency = baseFrequency[cat] || 1
    const implCost = baseCost[cat] || 4
    const runningCost = implCost * 0.1 // 10% of implementation as ongoing cost

    const costBenefit = (timeSaved * frequency) / (implCost + runningCost)

    return {
      time_saved: Math.round(timeSaved * 100) / 100,
      frequency,
      implementation_cost: implCost,
      running_cost: Math.round(runningCost * 100) / 100,
      cost_benefit: Math.round(costBenefit * 100) / 100,
      automation_type: 'script',
    }
  }

  // Classify what kind of automation this enhancement needs
  _classifyAutomation(enhancement) {
    const cat = enhancement.category
    if (cat === 'automation') return 'script'       // Repetitive → automate with script
    if (cat === 'performance') return 'code_change'  // Performance → optimize code
    if (cat === 'collaboration') return 'workflow'   // Multi-agent → orchestration workflow
    if (cat === 'accuracy') return 'skill'           // Accuracy → new skill definition
    return 'script'
  }

  // Post thought to the swarm API
  async _reportThought(thought) {
    const headers = { 'Content-Type': 'application/json' }
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`

    const body = {
      agent_id: this.agentId,
      agent_name: this.agentName,
      type: thought.type || 'observation',
      category: thought.category || '',
      title: thought.title || 'Untitled thought',
      content: thought.content || '',
      priority: thought.priority || 3,
      efficiency: thought.efficiency || null,
    }

    try {
      const res = await fetch(`${this.apiBase}/api/agents/thoughts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        console.error(`[${this.agentName}] Failed to report thought: ${res.status}`)
      }
    } catch (err) {
      // Silent fail — network issues shouldn't crash the agent
    }
  }

  // Get the last gathered context (for external inspection)
  getLastContext() {
    return this._lastContext
  }

  // Get engine status
  getStatus() {
    return {
      running: this._running,
      cycles: this._cycleCount,
      agent: this.agentName,
      interval: this.interval,
    }
  }
}

// Export for Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AutonomousEngine }
}
