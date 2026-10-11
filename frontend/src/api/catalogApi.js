import { apiClient } from './client';

export const catalogApi = {
  // دریافت لیست شبکه‌های فعال (BSC, TON)
  getNetworks: async () => {
    return apiClient.get('/api/v1/networks');
  },

  // دریافت لیست کوین‌ها و توکن‌های مربوط به یک شبکه
  getCurrencies: async (networkId) => {
    if (!networkId) throw new Error('شناسه شبکه الزامی است');
    return apiClient.get(`/api/v1/networks/${networkId}/currencies`);
  }
};
