import axios from 'axios';

const CAIDO_GRAPHQL = '/api/v1/caido/graphql';

export interface CaidoRequest {
  id: string;
  method: string;
  url: string;
  statusCode: number;
  responseLength: number;
  timestamp: string;
}

export const caidoAPI = {
  connect: (host: string, port: number, token: string) =>
    axios.post('/api/v1/caido/connect', { host, port, token }),

  testConnection: () =>
    axios.get('/api/v1/caido/status'),

  getRequests: (limit = 50) =>
    axios.get<CaidoRequest[]>(`/api/v1/caido/requests?limit=${limit}`),

  replayRequest: (requestId: string, modifications?: Record<string, string>) =>
    axios.post('/api/v1/caido/replay', { requestId, modifications }),

  interceptToggle: (enabled: boolean) =>
    axios.post('/api/v1/caido/intercept', { enabled }),

  // GraphQL passthrough to Caido
  query: (query: string, variables?: Record<string, unknown>) =>
    axios.post(CAIDO_GRAPHQL, { query, variables }),
};
