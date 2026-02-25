import axios, { AxiosInstance, AxiosError } from 'axios'
import toast from 'react-hot-toast'

// Type declaration for (import.meta as any).env
interface ImportMetaEnv {
  VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || ''

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('harbinger-token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Only show toast for non-GET requests or critical errors
        if (error.config?.method !== 'get' || error.response?.status === 401) {
          const message = (error.response?.data as any)?.message || error.message || 'Unknown error'
          console.error(`API Error: ${message}`)
          // Silent fail for offline mode - don't spam user with errors
          if (error.code !== 'ERR_NETWORK') {
            toast.error(`API Error: ${message}`)
          }
        }
        return Promise.reject(error)
      }
    )
  }

  get instance() {
    return this.client
  }

  // Generic request methods
  async get<T>(path: string, params?: Record<string, unknown>) {
    const response = await this.client.get<T>(path, { params })
    return response.data
  }

  async post<T>(path: string, data?: unknown) {
    const response = await this.client.post<T>(path, data)
    return response.data
  }

  async put<T>(path: string, data?: unknown) {
    const response = await this.client.put<T>(path, data)
    return response.data
  }

  async patch<T>(path: string, data?: unknown) {
    const response = await this.client.patch<T>(path, data)
    return response.data
  }

  async delete<T>(path: string) {
    const response = await this.client.delete<T>(path)
    return response.data
  }
}

export const apiClient = new ApiClient()
export default apiClient.instance
