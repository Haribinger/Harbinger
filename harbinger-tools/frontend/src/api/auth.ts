import { apiClient } from './client'

export interface GitHubAuthResponse {
  ok: boolean
  auth_url?: string
  state?: string
  error?: string
  reason?: string
  fix?: string
}

export interface UserResponse {
  ok: boolean
  user?: {
    user_id: string
    username: string
    email: string
    provider: string
  }
  error?: string
}

export const authApi = {
  /**
   * Initiate GitHub OAuth flow
   * Returns the GitHub authorization URL to redirect to
   */
  async initiateGitHubAuth(): Promise<GitHubAuthResponse> {
    // Named apiClient.get already unwraps .data
    return apiClient.get<GitHubAuthResponse>('/api/auth/github')
  },

  /**
   * Get current user info (requires authentication)
   */
  async getMe(): Promise<UserResponse> {
    return apiClient.get<UserResponse>('/api/auth/me')
  },

  /**
   * Logout (requires authentication)
   */
  async logout(): Promise<{ ok: boolean; message?: string }> {
    return apiClient.post<{ ok: boolean; message?: string }>('/api/auth/logout')
  },
}
