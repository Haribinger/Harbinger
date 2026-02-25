import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings, NotificationSettings, SecuritySettings, AdvancedSettings } from '../types'

interface SettingsState extends AppSettings {
  sidebarCollapsed: boolean
  rightPanelVisible: boolean

  // Actions
  updateSettings: (settings: Partial<AppSettings>) => void
  toggleSidebar: () => void
  toggleRightPanel: () => void
  setTheme: (theme: AppSettings['theme']) => void
  setLanguage: (language: string) => void
  resetSettings: () => void
  updateNotificationSettings: (s: Partial<NotificationSettings>) => void
  updateSecuritySettings: (s: Partial<SecuritySettings>) => void
  updateAdvancedSettings: (s: Partial<AdvancedSettings>) => void
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  language: 'en',
  notifications: true,
  autoSave: true,
  modelDefaults: {
    model: 'claude-opus-4-6',
    temperature: 0.7,
    maxTokens: 4096,
    thinking: 'adaptive',
  },
  dockerDefaults: {
    defaultImage: 'debian:latest',
    pentestImage: 'vxcontrol/kali-linux',
    autoCleanup: false,
    resourceLimits: {
      cpu: 2,
      memory: 4,
      swap: 1,
    },
  },
  mcpDefaults: {
    autoConnect: true,
    timeout: 30000,
    retryAttempts: 3,
  },
  notificationSettings: {
    agentCompletion: true,
    workflowStatus: true,
    containerEvents: false,
    securityFindings: true,
  },
  securitySettings: {
    rateLimiting: true,
    corsProtection: true,
    auditLogging: true,
    sslEnforcement: false,
    intrusionDetection: false,
  },
  advancedSettings: {
    debugMode: false,
    telemetry: false,
  },
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, _get) => ({
      ...defaultSettings,
      sidebarCollapsed: false,
      rightPanelVisible: true,

      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleRightPanel: () => set((state) => ({ rightPanelVisible: !state.rightPanelVisible })),
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      resetSettings: () => set(defaultSettings),
      updateNotificationSettings: (s) => set((state) => ({
        notificationSettings: { ...state.notificationSettings, ...s },
      })),
      updateSecuritySettings: (s) => set((state) => ({
        securitySettings: { ...state.securitySettings, ...s },
      })),
      updateAdvancedSettings: (s) => set((state) => ({
        advancedSettings: { ...state.advancedSettings, ...s },
      })),
    }),
    {
      name: 'harbinger-settings',
    }
  )
)
