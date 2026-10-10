import { apiClient } from './client';

export const catalogApi = {
  // دریافت لیست خدمات فعال همراه با قیمت دلاری
  getServices: async () => {
    return apiClient.get('/api/v1/services');
  },

  // دریافت لیست شبکه‌های فعال (TON, TRON)
  getNetworks: async () => {
    return apiClient.get('/api/v1/networks');
  },

  // دریافت لیست کوین‌ها و توکن‌های مربوط به یک شبکه
  getCurrencies: async (networkId) => {
    if (!networkId) throw new Error('شناسه شبکه الزامی است');
    return apiClient.get(`/api/v1/networks/${networkId}/currencies`);
  }
};
