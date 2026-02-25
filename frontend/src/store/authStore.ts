import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { APIResponse } from '../types'

interface User {
  id: string
  username: string
  email: string
  provider: string
}

type GitHubAuthData = { authUrl: string; state: string }

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
}

// API Base URL - use env or default to backend port
const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8081'

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

// Check if token is expired
export function isTokenExpired(token: string): APIResponse<boolean> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return { success: false, error: { code: 'invalid_token', message: 'Invalid token' } }
    }

    const claimsJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(claimsJson)

    return { success: true, data: claims.exp * 1000 < Date.now() }
  } catch {
    return { success: false, error: { code: 'invalid_token', message: 'Invalid token' } }
  }
}