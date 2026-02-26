import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { APIResponse } from '../types'
import { API_BASE } from '../config'

interface User {
  id: string
  username: string
  email: string
  provider: string
}

type GitHubAuthData = { authUrl: string; state: string }

type DeviceFlowData = {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  setToken: (token: string | null) => void
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  login: (token: string, user: User) => void
  logout: () => void
  clearError: () => void

  initiateGitHubAuth: () => Promise<APIResponse<GitHubAuthData> | null>
  startDeviceFlow: () => Promise<DeviceFlowData | null>
  pollDeviceFlow: (deviceCode: string) => Promise<boolean>
  loginWithGHToken: (token?: string) => Promise<{ ok: boolean; jwt?: string; error?: string } | null>
}

// API_BASE imported from config.ts — empty string means relative URLs (proxy handles routing)

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setToken: (token) => set({ token, isAuthenticated: !!token }),
      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      login: (token, user) => {
        set({ token, user, isAuthenticated: true, error: null })

        // Keep this optional + browser-only
        if (isBrowser()) {
          window.localStorage.setItem('harbinger-token', token)
        }
      },

      logout: () => {
        set({ token: null, user: null, isAuthenticated: false, error: null })
        if (isBrowser()) {
          window.localStorage.removeItem('harbinger-token')
        }
      },

      clearError: () => set({ error: null }),

      initiateGitHubAuth: async () => {
        set({ isLoading: true, error: null })

        try {
          const response = await fetch(`${API_BASE}/api/auth/github`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          })

          const json = await response.json().catch(() => null)

          // Backend returns: { ok: true, auth_url: "...", state: "..." }
          if (!response.ok || !json || !json.ok) {
            const message =
              json?.error ||
              json?.message ||
              `Failed to initiate GitHub auth (${response.status})`

            set({ error: message })
            return { success: false, error: { code: 'auth_failed', message } }
          }

          // Backend returns auth_url and state directly, not nested in data
          const authUrl = json.auth_url
          const state = json.state
          if (!authUrl || !state) {
            const message = 'Malformed auth response from server'
            set({ error: message })
            return { success: false, error: { code: 'bad_response', message } }
          }

          return { success: true, data: { authUrl, state } }
        } catch (e) {
          set({ error: 'Network error' })
          return null
        } finally {
          set({ isLoading: false })
        }
      },

      startDeviceFlow: async () => {
        try {
          const response = await fetch(`${API_BASE}/api/auth/github/device/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
          const json = await response.json().catch(() => null)
          if (!json?.ok) return null
          return {
            deviceCode: json.device_code,
            userCode: json.user_code,
            verificationUri: json.verification_uri,
            expiresIn: json.expires_in,
            interval: json.interval,
          }
        } catch {
          return null
        }
      },

      pollDeviceFlow: async (deviceCode: string) => {
        try {
          const response = await fetch(`${API_BASE}/api/auth/github/device/poll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_code: deviceCode }),
          })
          const json = await response.json().catch(() => null)
          if (!json?.ok || !json.jwt) return false
          // Device flow authorized — parse the JWT and log in
          const parsed = parseJWT(json.jwt)
          if (parsed?.success && parsed.data) {
            useAuthStore.getState().login(json.jwt, parsed.data)
            return true
          }
          return false
        } catch {
          return false
        }
      },

      loginWithGHToken: async (token?: string) => {
        try {
          let response: Response
          if (token) {
            // Validate provided PAT against GitHub API, get Harbinger JWT
            response = await fetch(`${API_BASE}/api/auth/github/token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token }),
            })
          } else {
            // Use GH_TOKEN env var configured on the server
            response = await fetch(`${API_BASE}/api/auth/github/token/env`, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            })
          }
          const json = await response.json().catch(() => null)
          if (!json) return null
          return { ok: !!json.ok, jwt: json.jwt, error: json.error }
        } catch {
          return null
        }
      },
    }),
    {
      name: 'harbinger-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
      storage: createJSONStorage(() => {
        // Prevent SSR crash
        if (!isBrowser()) return undefined as any
        return window.localStorage
      }),
    }
  )
)

// Parse JWT token to extract claims
export function parseJWT(token: string): APIResponse<User> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const claimsJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(claimsJson)

    return {
      success: true,
      data: {
        id: claims.user_id,
        username: claims.username,
        email: claims.email,
        provider: claims.provider,
      },
    }
  } catch {
    return { success: false, error: { code: 'invalid_token', message: 'Invalid token' } }
  }
}

// Check if token is expired — returns true if expired or invalid
export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true

    const claimsJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(claimsJson)

    return claims.exp * 1000 < Date.now()
  } catch {
    return true
  }
}