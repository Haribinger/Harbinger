import apiClient from './client'

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
    const response = await apiClient.get<GitHubAuthResponse>('/api/auth/github')
    return response.data
  },

  /**
   * Get current user info (requires authentication)
   */
  async getMe(): Promise<UserResponse> {
    const response = await apiClient.get<UserResponse>('/api/auth/me')
    return response.data
  },

  /**
   * Logout (requires authentication)
   * Note: In a real implementation, this might invalidate the token server-side
   */
  async logout(): Promise<{ ok: boolean; message?: string }> {
    const response = await apiClient.post<{ ok: boolean; message?: string }>('/api/auth/logout')
    return response.data
  },
}
