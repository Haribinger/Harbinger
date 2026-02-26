import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HarbingerTheme, ThemeTokens } from '../types/theme'
import { BUILTIN_THEMES } from '../types/theme'

export interface ThemeSchedule {
  dayThemeId: string
  nightThemeId: string
  dayStart: string   // "08:00"
  nightStart: string // "20:00"
  enabled: boolean
}

interface ThemeState {
  // Current active theme ID
  activeThemeId: string

  // User-created custom themes (builtins loaded from BUILTIN_THEMES)
  customThemes: HarbingerTheme[]

  // Per-agent theme overrides
  agentThemes: Record<string, string> // agentId → themeId

  // Day/night schedule
  schedule: ThemeSchedule

  // Actions
  setActiveTheme: (id: string) => void
  addCustomTheme: (theme: HarbingerTheme) => void
  updateCustomTheme: (id: string, updates: Partial<HarbingerTheme>) => void
  deleteCustomTheme: (id: string) => void
  duplicateTheme: (id: string) => void
  importTheme: (json: string) => HarbingerTheme | null
  exportTheme: (id: string) => string | null

  // Agent themes
  setAgentTheme: (agentId: string, themeId: string | null) => void
  getAgentTheme: (agentId: string) => string | undefined

  // Schedule
  setSchedule: (schedule: Partial<ThemeSchedule>) => void
  checkSchedule: () => void

  // Backend sync
  syncToBackend: () => Promise<void>
  loadFromBackend: () => Promise<void>

  // Computed helpers
  getActiveTheme: () => HarbingerTheme
  getAllThemes: () => HarbingerTheme[]
  getThemeById: (id: string) => HarbingerTheme | undefined
}

// Apply theme tokens to CSS custom properties on :root
export function applyTheme(tokens: ThemeTokens, fontFamily: 'mono' | 'sans' | 'system') {
  const root = document.documentElement
  // Remove any light class — themes control everything via variables
  root.classList.remove('light')

  root.style.setProperty('--color-background', tokens.background)
  root.style.setProperty('--color-surface', tokens.surface)
  root.style.setProperty('--color-surface-light', tokens.surfaceLight)
  root.style.setProperty('--color-surface-dark', tokens.surfaceDark)
  root.style.setProperty('--color-text-primary', tokens.textPrimary)
  root.style.setProperty('--color-text-secondary', tokens.textSecondary)
  root.style.setProperty('--color-border', tokens.border)

  // Legacy variables (used by inline styles)
  root.style.setProperty('--background', tokens.background)
  root.style.setProperty('--surface', tokens.surface)
  root.style.setProperty('--surface-light', tokens.surfaceLight)
  root.style.setProperty('--text-primary', tokens.textPrimary)
  root.style.setProperty('--text-secondary', tokens.textSecondary)
  root.style.setProperty('--border', tokens.border)

  // Accent
  root.style.setProperty('--color-accent', tokens.accent)
  root.style.setProperty('--color-accent-hover', tokens.accentHover)
  root.style.setProperty('--color-danger', tokens.danger)
  root.style.setProperty('--color-success', tokens.success)
  root.style.setProperty('--color-warning', tokens.warning)
  root.style.setProperty('--color-info', tokens.info)

  // Scrollbar
  root.style.setProperty('--scrollbar-track', tokens.scrollbarTrack)
  root.style.setProperty('--scrollbar-thumb', tokens.scrollbarThumb)
  root.style.setProperty('--scrollbar-thumb-hover', tokens.scrollbarThumbHover)

  // Terminal
  root.style.setProperty('--terminal-bg', tokens.terminalBg)

  // Glass
  root.style.setProperty('--glass-bg', tokens.glassBg)
  root.style.setProperty('--glass-border', tokens.glassBorder)

  // Font family
  const fontMap = {
    mono: "'JetBrains Mono', 'Fira Code', monospace",
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  }
  root.style.setProperty('--theme-font', fontMap[fontFamily])
}

const DEFAULT_THEME_ID = 'obsidian-command'

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('harbinger-token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      activeThemeId: DEFAULT_THEME_ID,
      customThemes: [],
      agentThemes: {},
      schedule: {
        dayThemeId: 'obsidian-command',
        nightThemeId: 'obsidian-command',
        dayStart: '08:00',
        nightStart: '20:00',
        enabled: false,
      },

      setActiveTheme: (id) => {
        const theme = get().getThemeById(id)
        if (theme) {
          set({ activeThemeId: id })
          applyTheme(theme.tokens, theme.fontFamily)
        }
      },

      addCustomTheme: (theme) => {
        set((state) => ({
          customThemes: [...state.customThemes, { ...theme, builtin: false }],
        }))
      },

      updateCustomTheme: (id, updates) => {
        set((state) => ({
          customThemes: state.customThemes.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
          ),
        }))
        // Re-apply if this is the active theme
        if (get().activeThemeId === id) {
          const updated = get().getThemeById(id)
          if (updated) applyTheme(updated.tokens, updated.fontFamily)
        }
      },

      deleteCustomTheme: (id) => {
        const theme = get().getThemeById(id)
        if (theme?.builtin) return
        if (get().activeThemeId === id) {
          const def = BUILTIN_THEMES[0]
          set({ activeThemeId: def.id })
          applyTheme(def.tokens, def.fontFamily)
        }
        set((state) => ({
          customThemes: state.customThemes.filter((t) => t.id !== id),
        }))
      },

      duplicateTheme: (id) => {
        const source = get().getThemeById(id)
        if (!source) return
        const now = new Date().toISOString()
        const newTheme: HarbingerTheme = {
          ...source,
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: `${source.name} (Copy)`,
          author: 'User',
          builtin: false,
          createdAt: now,
          updatedAt: now,
          tokens: { ...source.tokens },
          tags: [...source.tags],
        }
        get().addCustomTheme(newTheme)
      },

      importTheme: (json) => {
        try {
          const parsed = JSON.parse(json)
          if (!parsed.id || !parsed.name || !parsed.tokens) return null
          const now = new Date().toISOString()
          const theme: HarbingerTheme = {
            ...parsed,
            id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            builtin: false,
            createdAt: now,
            updatedAt: now,
          }
          get().addCustomTheme(theme)
          return theme
        } catch {
          return null
        }
      },

      exportTheme: (id) => {
        const theme = get().getThemeById(id)
        if (!theme) return null
        return JSON.stringify(theme, null, 2)
      },

      // ─── Agent Themes ───────────────────────────────────────────────
      setAgentTheme: (agentId, themeId) => {
        set((state) => {
          const next = { ...state.agentThemes }
          if (themeId) {
            next[agentId] = themeId
          } else {
            delete next[agentId]
          }
          return { agentThemes: next }
        })
        // Sync to backend
        fetch('/api/themes/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({ agentId, themeId: themeId || '' }),
        }).catch(() => {})
      },

      getAgentTheme: (agentId) => {
        return get().agentThemes[agentId]
      },

      // ─── Schedule ───────────────────────────────────────────────────
      setSchedule: (updates) => {
        set((state) => ({
          schedule: { ...state.schedule, ...updates },
        }))
        // Sync to backend
        const sched = get().schedule
        fetch('/api/themes/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify(sched),
        }).catch(() => {})
      },

      checkSchedule: () => {
        const { schedule, setActiveTheme, activeThemeId } = get()
        if (!schedule.enabled) return

        const now = new Date()
        const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

        const isDay = hhmm >= schedule.dayStart && hhmm < schedule.nightStart
        const targetId = isDay ? schedule.dayThemeId : schedule.nightThemeId

        if (targetId && targetId !== activeThemeId) {
          setActiveTheme(targetId)
        }
      },

      // ─── Backend Sync ──────────────────────────────────────────────
      syncToBackend: async () => {
        const { customThemes } = get()
        for (const theme of customThemes) {
          await fetch('/api/themes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify(theme),
          }).catch(() => {})
        }
      },

      loadFromBackend: async () => {
        try {
          const res = await fetch('/api/themes', { headers: getAuthHeader() })
          if (!res.ok) return
          const data = await res.json()
          const themes: HarbingerTheme[] = Array.isArray(data.themes) ? data.themes : []
          if (themes.length > 0) {
            // Merge — don't overwrite local themes, add new ones from backend
            const existing = new Set(get().customThemes.map((t) => t.id))
            const newThemes = themes.filter((t) => !existing.has(t.id))
            if (newThemes.length > 0) {
              set((state) => ({
                customThemes: [...state.customThemes, ...newThemes],
              }))
            }
          }
        } catch {
          // Backend unreachable — no-op
        }
      },

      // ─── Helpers ────────────────────────────────────────────────────
      getActiveTheme: () => {
        const all = get().getAllThemes()
        return all.find((t) => t.id === get().activeThemeId) || BUILTIN_THEMES[0]
      },

      getAllThemes: () => {
        return [...BUILTIN_THEMES, ...get().customThemes]
      },

      getThemeById: (id) => {
        return [...BUILTIN_THEMES, ...get().customThemes].find((t) => t.id === id)
      },
    }),
    {
      name: 'harbinger-themes',
      partialize: (state) => ({
        activeThemeId: state.activeThemeId,
        customThemes: state.customThemes,
        agentThemes: state.agentThemes,
        schedule: state.schedule,
      }),
    }
  )
)
