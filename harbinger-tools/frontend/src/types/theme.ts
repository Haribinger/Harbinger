// Theme token definitions — every CSS variable that a theme can control
export interface ThemeTokens {
  // Core surfaces
  background: string
  surface: string
  surfaceLight: string
  surfaceDark: string

  // Text
  textPrimary: string
  textSecondary: string

  // Borders
  border: string

  // Accent colors
  accent: string       // Primary accent (gold #f0c040 in Obsidian Command)
  accentHover: string  // Hover state
  danger: string
  success: string
  warning: string
  info: string

  // Scrollbar
  scrollbarTrack: string
  scrollbarThumb: string
  scrollbarThumbHover: string

  // Terminal
  terminalBg: string

  // Glass
  glassBg: string
  glassBorder: string
}

export interface HarbingerTheme {
  id: string
  name: string
  description: string
  author: string
  version: string
  createdAt: string
  updatedAt: string

  // Visual identity
  tokens: ThemeTokens
  fontFamily: 'mono' | 'sans' | 'system'

  // Metadata
  tags: string[]
  builtin: boolean
}

// Minimal theme reference for lists
export interface ThemeSummary {
  id: string
  name: string
  description: string
  author: string
  accent: string
  background: string
  builtin: boolean
}

// ─── Built-in themes ────────────────────────────────────────────────────────

export const BUILTIN_THEMES: HarbingerTheme[] = [
  {
    id: 'obsidian-command',
    name: 'Obsidian Command',
    description: 'Default dark theme — gold accent on deep black',
    author: 'Harbinger',
    version: '1.0.0',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    fontFamily: 'mono',
    tags: ['dark', 'default', 'gold'],
    builtin: true,
    tokens: {
      background: '#0a0a0f',
      surface: '#0d0d15',
      surfaceLight: '#1a1a2e',
      surfaceDark: '#070710',
      textPrimary: '#ffffff',
      textSecondary: '#9ca3af',
      border: 'rgba(255, 255, 255, 0.08)',
      accent: '#f0c040',
      accentHover: '#f5d060',
      danger: '#ef4444',
      success: '#22c55e',
      warning: '#f59e0b',
      info: '#06b6d4',
      scrollbarTrack: '#0d0d15',
      scrollbarThumb: '#3f3f5a',
      scrollbarThumbHover: '#555575',
      terminalBg: '#0d0d15',
      glassBg: 'rgba(13, 13, 21, 0.8)',
      glassBorder: 'rgba(255, 255, 255, 0.08)',
    },
  },
  {
    id: 'retro-terminal',
    name: 'Retro Terminal',
    description: 'Classic green-on-black hacker aesthetic',
    author: 'Harbinger',
    version: '1.0.0',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    fontFamily: 'mono',
    tags: ['dark', 'terminal', 'green', 'retro'],
    builtin: true,
    tokens: {
      background: '#0a0a0a',
      surface: '#111111',
      surfaceLight: '#1a1a1a',
      surfaceDark: '#050505',
      textPrimary: '#00ff41',
      textSecondary: '#00aa2a',
      border: 'rgba(0, 255, 65, 0.15)',
      accent: '#00ff41',
      accentHover: '#33ff66',
      danger: '#ff3333',
      success: '#00ff41',
      warning: '#ffaa00',
      info: '#00ccff',
      scrollbarTrack: '#111111',
      scrollbarThumb: '#1a3a1a',
      scrollbarThumbHover: '#2a5a2a',
      terminalBg: '#0a0a0a',
      glassBg: 'rgba(10, 10, 10, 0.9)',
      glassBorder: 'rgba(0, 255, 65, 0.1)',
    },
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    description: 'Hot pink and electric blue on dark purple',
    author: 'Harbinger',
    version: '1.0.0',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    fontFamily: 'mono',
    tags: ['dark', 'neon', 'cyberpunk', 'pink'],
    builtin: true,
    tokens: {
      background: '#0d0221',
      surface: '#150535',
      surfaceLight: '#1f0a4a',
      surfaceDark: '#08011a',
      textPrimary: '#e0e0ff',
      textSecondary: '#8888bb',
      border: 'rgba(255, 0, 200, 0.15)',
      accent: '#ff00c8',
      accentHover: '#ff33d6',
      danger: '#ff2222',
      success: '#00ff88',
      warning: '#ffcc00',
      info: '#00ccff',
      scrollbarTrack: '#150535',
      scrollbarThumb: '#3a1060',
      scrollbarThumbHover: '#5a1890',
      terminalBg: '#0d0221',
      glassBg: 'rgba(13, 2, 33, 0.85)',
      glassBorder: 'rgba(255, 0, 200, 0.1)',
    },
  },
  {
    id: 'arctic-frost',
    name: 'Arctic Frost',
    description: 'Cool blue tones — icy and minimal',
    author: 'Harbinger',
    version: '1.0.0',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    fontFamily: 'sans',
    tags: ['dark', 'blue', 'frost', 'minimal'],
    builtin: true,
    tokens: {
      background: '#0b1120',
      surface: '#0f1a2e',
      surfaceLight: '#162340',
      surfaceDark: '#080d18',
      textPrimary: '#e2e8f0',
      textSecondary: '#7890aa',
      border: 'rgba(100, 160, 255, 0.12)',
      accent: '#38bdf8',
      accentHover: '#5cc8fa',
      danger: '#f43f5e',
      success: '#34d399',
      warning: '#fbbf24',
      info: '#38bdf8',
      scrollbarTrack: '#0f1a2e',
      scrollbarThumb: '#1e3550',
      scrollbarThumbHover: '#2a4a6a',
      terminalBg: '#0b1120',
      glassBg: 'rgba(11, 17, 32, 0.85)',
      glassBorder: 'rgba(100, 160, 255, 0.08)',
    },
  },
  {
    id: 'blood-moon',
    name: 'Blood Moon',
    description: 'Deep crimson and dark ember tones',
    author: 'Harbinger',
    version: '1.0.0',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    fontFamily: 'mono',
    tags: ['dark', 'red', 'aggressive'],
    builtin: true,
    tokens: {
      background: '#0f0808',
      surface: '#1a0e0e',
      surfaceLight: '#2a1515',
      surfaceDark: '#080505',
      textPrimary: '#f0d0d0',
      textSecondary: '#aa7777',
      border: 'rgba(255, 50, 50, 0.12)',
      accent: '#dc2626',
      accentHover: '#ef4444',
      danger: '#ff4444',
      success: '#22c55e',
      warning: '#f59e0b',
      info: '#60a5fa',
      scrollbarTrack: '#1a0e0e',
      scrollbarThumb: '#3a1818',
      scrollbarThumbHover: '#552222',
      terminalBg: '#0f0808',
      glassBg: 'rgba(15, 8, 8, 0.85)',
      glassBorder: 'rgba(255, 50, 50, 0.08)',
    },
  },
  {
    id: 'midnight-purple',
    name: 'Midnight Purple',
    description: 'Rich purple gradients on black velvet',
    author: 'Harbinger',
    version: '1.0.0',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    fontFamily: 'mono',
    tags: ['dark', 'purple', 'elegant'],
    builtin: true,
    tokens: {
      background: '#0a0812',
      surface: '#120f1e',
      surfaceLight: '#1c1832',
      surfaceDark: '#06050c',
      textPrimary: '#e8e0ff',
      textSecondary: '#9088aa',
      border: 'rgba(139, 92, 246, 0.12)',
      accent: '#8b5cf6',
      accentHover: '#a78bfa',
      danger: '#ef4444',
      success: '#34d399',
      warning: '#fbbf24',
      info: '#60a5fa',
      scrollbarTrack: '#120f1e',
      scrollbarThumb: '#2a2244',
      scrollbarThumbHover: '#3a3060',
      terminalBg: '#0a0812',
      glassBg: 'rgba(10, 8, 18, 0.85)',
      glassBorder: 'rgba(139, 92, 246, 0.08)',
    },
  },
]
