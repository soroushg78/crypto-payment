DELETE FROM services WHERE code IN ('VIP_1M', 'VIP_3M', 'WALLET_CREDIT_10');
DELETE FROM currencies WHERE (symbol = 'TON' AND network_id = 'ton') OR (symbol = 'USDT' AND network_id IN ('ton', 'tron'));
DELETE FROM networks WHERE id IN ('ton', 'tron');
