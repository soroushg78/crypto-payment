import { apiClient } from './client';

export const rebalanceApi = {
  // دریافت لیست تمام آدرس‌های تولید شده BSC به همراه موجودی زنجیره‌ای
  getBSCWallets: async () => {
    return apiClient.get('/api/v1/rebalance/wallets');
  },

  // اجرای عملیات سوئیپ و ریبالانسینگ (شبیه‌سازی امن یا برادکست واقعی)
  sweepWallet: async ({ derivationIndex, asset = 'USDT', treasuryAddress, realBroadcast = false }) => {
    return apiClient.post('/api/v1/rebalance/sweep', {
      derivation_index: derivationIndex,
      asset: asset,
      treasury_address: treasuryAddress || undefined,
      real_broadcast: realBroadcast
    });
  },

  // دریافت مشخصات امنیتی و معماری کلیدها (BIP-44, Zero DB storage)
  getSecuritySpecs: async () => {
    return apiClient.get('/api/v1/rebalance/security');
  },

  // تخمین زنده گس‌فی و بررسی کسری سوخت از نود BSC
  estimateGas: async ({ derivationIndex, asset = 'USDT', treasuryAddress }) => {
    return apiClient.get(`/api/v1/rebalance/estimate?index=${derivationIndex}&asset=${asset}&treasury=${treasuryAddress || ''}`);
  },

  // اجرای ریبالانس دسته‌جمعی والت‌ها (Batch Sweep)
  sweepBatch: async ({ derivationIndexes, asset = 'ALL', treasuryAddress, realBroadcast = true }) => {
    return apiClient.post('/api/v1/rebalance/sweep-batch', {
      derivation_indexes: derivationIndexes,
      asset: asset,
      treasury_address: treasuryAddress || undefined,
      real_broadcast: realBroadcast
    });
  }
};
