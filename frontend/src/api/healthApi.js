import { apiClient } from './client';

export const healthApi = {
  checkHealth: async () => {
    return apiClient.get('/health', {
      signal: AbortSignal.timeout(3000)
    });
  }
};
