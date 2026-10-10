import { apiClient } from './client';

export const invoiceApi = {
  // صدور فاکتور جدید
  createInvoice: async ({ serviceId, currencyId, networkId, telegramId, username, customAmount }) => {
    return apiClient.post('/api/v1/invoices', {
      service_id: serviceId,
      currency_id: currencyId,
      network_id: networkId,
      telegram_id: telegramId ? parseInt(telegramId, 10) : undefined,
      username: username || undefined,
      custom_amount: customAmount ? parseFloat(customAmount) : undefined
    });
  },

  // استعلام فاکتور با شناسه UUID
  getInvoiceById: async (id) => {
    if (!id) throw new Error('شناسه فاکتور الزامی است');
    return apiClient.get(`/api/v1/invoices/${id}`);
  },

  // استعلام فاکتور با شماره فاکتور
  getInvoiceByNumber: async (number) => {
    if (!number) throw new Error('شماره فاکتور الزامی است');
    return apiClient.get(`/api/v1/invoices/number/${number}`);
  }
};
