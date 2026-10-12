import { apiClient } from './client';

export const invoiceApi = {
  // صدور فاکتور جدید
  createInvoice: async ({
    amountUSD,
    amount_usd,
    currencyId,
    currency,
    networkId,
    network,
    telegramId,
    username
  }) => {
    const finalAmount =
      amountUSD !== undefined
        ? parseFloat(amountUSD)
        : amount_usd !== undefined
        ? parseFloat(amount_usd)
        : 0;

    return apiClient.post('/api/v1/invoices', {
      amount_usd: finalAmount,
      currency_id: currencyId || undefined,
      currency: currency || undefined,
      network_id: networkId || undefined,
      network: network || undefined,
      telegram_id: telegramId ? parseInt(telegramId, 10) : undefined,
      username: username || undefined
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
  },

  // دریافت لیست تمام فاکتورهای واقعی از دیتابیس PostgreSQL
  listInvoices: async (limit = 100) => {
    return apiClient.get(`/api/v1/invoices?limit=${limit}`);
  },

  // استعلام نرخ‌های زنده ارزها از صرافی والکس (Wallex)
  getRates: async () => {
    return apiClient.get('/api/v1/rates');
  }
};

