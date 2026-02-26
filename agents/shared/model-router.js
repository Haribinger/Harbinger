/**
 * SmartModelRouter — Local-first model routing for all Harbinger agents.
 *
 * Picks the cheapest sufficient model for each task. Nothing leaves the system
 * unless explicitly configured. Five complexity tiers, per-agent overrides,
 * provider health checks.
 */

class SmartModelRouter {
  constructor(opts = {}) {
    this.apiBase = opts.apiBase || process.env.HARBINGER_API || 'http://localhost:8080'
    this.localOnly = opts.localOnly || false

    // Provider registry — local providers first
    this.providers = {
      ollama:    { type: 'local',  baseUrl: 'http://localhost:11434', models: ['llama3', 'codellama', 'mistral', 'phi3'] },
      lmstudio:  { type: 'local',  baseUrl: 'http://localhost:1234/v1', models: ['local-model'] },
      gpt4all:   { type: 'local',  baseUrl: 'http://localhost:4891/v1', models: ['local-model'] },
      anthropic:  { type: 'cloud', baseUrl: 'https://api.anthropic.com', models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] },
      openai:     { type: 'cloud', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'o1'] },
      google:     { type: 'cloud', baseUrl: 'https://generativelanguage.googleapis.com', models: ['gemini-2.0-flash', 'gemini-pro'] },
    }

    // Complexity tiers — tokens and time budgets
    this.tiers = {
      trivial:  { maxTokens: 500,   timeout: 1000,  description: 'Greetings, simple lookups' },
      simple:   { maxTokens: 2000,  timeout: 5000,  description: 'Single-step tasks, short answers' },
      moderate: { maxTokens: 4000,  timeout: 15000, description: 'Multi-step analysis, code review' },
      complex:  { maxTokens: 8000,  timeout: 30000, description: 'Deep reasoning, exploit dev' },
      massive:  { maxTokens: 32000, timeout: 60000, description: 'Full codebase analysis, report gen' },
    }

    // Default route table — local-first
    this.routes = {
      trivial:  { provider: 'ollama', model: 'llama3',     fallback: null },
      simple:   { provider: 'ollama', model: 'llama3',     fallback: null },
      moderate: { provider: 'ollama', model: 'codellama',  fallback: { provider: 'anthropic', model: 'claude-sonnet-4-6' } },
      complex:  { provider: 'anthropic', model: 'claude-sonnet-4-6', fallback: { provider: 'anthropic', model: 'claude-opus-4-6' } },
      massive:  { provider: 'anthropic', model: 'claude-opus-4-6',   fallback: { provider: 'anthropic', model: 'claude-opus-4-6' } },
    }

    // Per-agent overrides
    this.agentOverrides = opts.agentOverrides || {}
  }

  /**
   * Select the best model for a task.
   *
   * Priority chain:
   * 1. User preference (explicit model request)
   * 2. Agent override (pinned model for this agent)
   * 3. Complexity classification → route table
   * 4. Provider health check → fallback if primary down
   */
  async selectModel(task, context = {}) {
    // 1. User preference wins
    if (context.preferredModel) {
      return { provider: context.preferredProvider || 'anthropic', model: context.preferredModel, reason: 'user_preference' }
    }

    // 2. Agent override
    if (context.agentId && this.agentOverrides[context.agentId]) {
      const override = this.agentOverrides[context.agentId]
      return { ...override, reason: 'agent_override' }
    }

    // 3. Classify complexity
    const complexity = this.assessComplexity(task)
    const route = this.routes[complexity]

    if (!route) {
      return { provider: 'ollama', model: 'llama3', complexity, reason: 'default_fallback' }
    }

    // 4. Local mode enforcement
    if (this.localOnly && this.providers[route.provider]?.type === 'cloud') {
      return { provider: 'ollama', model: 'llama3', complexity, reason: 'local_mode_enforced' }
    }

    // 5. Health check primary provider
    const primaryAvailable = await this.isProviderAvailable(route.provider)
    if (primaryAvailable) {
      return { provider: route.provider, model: route.model, complexity, reason: 'route_table' }
    }

    // 6. Fallback
    if (route.fallback) {
      const fallbackAvailable = await this.isProviderAvailable(route.fallback.provider)
      if (fallbackAvailable) {
        return { ...route.fallback, complexity, reason: 'fallback' }
      }
    }

    // 7. Last resort — local model
    return { provider: 'ollama', model: 'llama3', complexity, reason: 'last_resort' }
  }

  /**
   * Assess task complexity based on content analysis.
   * Returns: 'trivial' | 'simple' | 'moderate' | 'complex' | 'massive'
   */
  assessComplexity(task) {
    if (!task || typeof task !== 'string') return 'simple'

    let score = 0
    const text = task.toLowerCase()

    // Token estimate — rough proxy
    const tokenEstimate = text.split(/\s+/).length * 1.3
    if (tokenEstimate > 500) score += 2
    if (tokenEstimate > 2000) score += 2
    if (tokenEstimate > 5000) score += 2

    // Reasoning depth indicators
    if (/\b(analyze|explain|compare|evaluate|synthesize)\b/.test(text)) score += 2
    if (/\b(why|how|reason|because|therefore)\b/.test(text)) score += 1

    // Code task indicators
    if (/\b(code|function|class|implement|refactor|debug)\b/.test(text)) score += 2
    if (/\b(exploit|vulnerability|payload|injection|bypass)\b/.test(text)) score += 3

    // Math/logic indicators
    if (/\b(calculate|equation|algorithm|optimize|crypto)\b/.test(text)) score += 2

    // Conversational / trivial indicators
    if (/^(hi|hello|hey|thanks|ok|yes|no)\b/i.test(text)) return 'trivial'
    if (text.length < 20) return 'trivial'

    // Map score to tier
    if (score <= 1) return 'trivial'
    if (score <= 3) return 'simple'
    if (score <= 6) return 'moderate'
    if (score <= 9) return 'complex'
    return 'massive'
  }

  /**
   * Check if a provider is reachable.
   */
  async isProviderAvailable(providerName) {
    const provider = this.providers[providerName]
    if (!provider) return false

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)

      // Local providers: hit their health endpoint
      if (provider.type === 'local') {
        const url = providerName === 'ollama'
          ? `${provider.baseUrl}/api/tags`
          : `${provider.baseUrl}/models`
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timeout)
        return res.ok
      }

      // Cloud providers: assume available if configured (don't waste API calls)
      clearTimeout(timeout)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get the current route table (for Settings UI).
   */
  getRoutes() {
    return Object.entries(this.routes).map(([tier, route]) => ({
      tier,
      ...this.tiers[tier],
      provider: route.provider,
      model: route.model,
      fallbackProvider: route.fallback?.provider || null,
      fallbackModel: route.fallback?.model || null,
    }))
  }

  /**
   * Update a route in the table.
   */
  updateRoute(tier, update) {
    if (!this.routes[tier]) return false
    Object.assign(this.routes[tier], update)
    return true
  }
}

module.exports = SmartModelRouter
