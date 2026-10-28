import { apiClient } from './client';

export const rebalanceApi = {
  // دریافت لیست تمام آدرس‌های تولید شده (BSC یا ETH) به همراه موجودی زنجیره‌ای
  getWallets: async (network = 'bsc') => {
    return apiClient.get(`/api/v1/rebalance/wallets?network=${network}`);
  },

  // جهت سازگاری به عقب
  getBSCWallets: async () => {
    return rebalanceApi.getWallets('bsc');
  },

  // اجرای عملیات سوئیپ و ریبالانسینگ واقعی آنچین با پشتیبانی از Many-to-Many Multi-Vault
  sweepWallet: async ({ derivationIndex, asset = 'USDT', treasuryAddress, vaultSplits, network = 'bsc', realBroadcast = true, mnemonic }) => {
    return apiClient.post('/api/v1/rebalance/sweep', {
      network_id: network,
      derivation_index: derivationIndex,
      asset: asset,
      treasury_address: treasuryAddress || undefined,
      vault_splits: vaultSplits && vaultSplits.length > 0 ? vaultSplits : undefined,
      real_broadcast: realBroadcast,
      mnemonic: mnemonic ? mnemonic.trim() : undefined
    });
  },

  // دریافت مشخصات امنیتی و معماری کلیدها (BIP-44, Zero DB storage)
  getSecuritySpecs: async () => {
    return apiClient.get('/api/v1/rebalance/security');
  },

  // تخمین زنده گس‌فی و بررسی کسری سوخت از نود BSC/ETH
  estimateGas: async ({ derivationIndex, asset = 'USDT', treasuryAddress, network = 'bsc' }) => {
    return apiClient.get(`/api/v1/rebalance/estimate?index=${derivationIndex}&asset=${asset}&treasury=${treasuryAddress || ''}&network=${network}`);
  },

  // اجرای ریبالانس دسته‌جمعی والت‌ها (Batch Many-to-Many Sweep)
  sweepBatch: async ({ derivationIndexes, asset = 'ALL', treasuryAddress, vaultSplits, network = 'bsc', realBroadcast = true, mnemonic }) => {
    return apiClient.post('/api/v1/rebalance/sweep-batch', {
      network_id: network,
      derivation_indexes: derivationIndexes,
      asset: asset,
      treasury_address: treasuryAddress || undefined,
      vault_splits: vaultSplits && vaultSplits.length > 0 ? vaultSplits : undefined,
      real_broadcast: realBroadcast,
      mnemonic: mnemonic ? mnemonic.trim() : undefined
    });
  },

  // دریافت اطلاعات خزانه‌داری متمرکز و ریبالانسینگ شبکه TON
  getTONTreasury: async () => {
    return apiClient.get('/api/v1/rebalance/ton');
  },

  // دریافت سوابق جامع عملیات ریبالانسینگ از دیتابیس PostgreSQL
  getRebalanceRecords: async (limit = 100) => {
    return apiClient.get(`/api/v1/rebalance/records?limit=${limit}`);
  }
};
