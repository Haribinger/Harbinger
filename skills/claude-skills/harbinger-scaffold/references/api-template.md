# API Module Template

API modules live in `harbinger-tools/frontend/src/api/`. They use the shared ApiClient.

## Template

```typescript
import { apiClient } from './client'

// Types
export interface ItemResponse {
  id: string
  name: string
  status: string
  created_at: string
  updated_at: string
}

export interface CreateItemRequest {
  name: string
  type: string
  config?: Record<string, unknown>
}

// API functions
export const itemsApi = {
  getAll: async (): Promise<ItemResponse[]> => {
    const result = await apiClient.get<ItemResponse[] | { items: ItemResponse[] }>('/api/items')
    return Array.isArray(result) ? result : (Array.isArray(result?.items) ? result.items : [])
  },

  getById: async (id: string): Promise<ItemResponse> => {
    return apiClient.get<ItemResponse>(`/api/items/${id}`)
  },

  create: async (data: CreateItemRequest): Promise<ItemResponse> => {
    return apiClient.post<ItemResponse>('/api/items', data)
  },

  update: async (id: string, data: Partial<CreateItemRequest>): Promise<ItemResponse> => {
    return apiClient.patch<ItemResponse>(`/api/items/${id}`, data)
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/api/items/${id}`)
  },
}
```

## Key Conventions

- Use `apiClient` from `./client` — never raw `fetch` or `axios`
- API_BASE is empty string (Vite proxy routes `/api/*` to `:8080`)
- Response normalization on every array endpoint
- Types use snake_case for JSON fields (matching Go backend)
- Export as object with named methods, not individual functions
