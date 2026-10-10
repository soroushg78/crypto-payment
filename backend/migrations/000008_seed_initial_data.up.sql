-- Networks
INSERT INTO networks (id, name, native_currency, rpc_endpoint, is_testnet, is_active)
VALUES 
    ('ton', 'The Open Network', 'TON', 'https://toncenter.com/api/v2/jsonRPC', false, true),
    ('tron', 'TRON Network', 'TRX', 'https://api.trongrid.io', false, true)
ON CONFLICT (id) DO NOTHING;

-- Currencies
INSERT INTO currencies (id, symbol, network_id, contract_address, decimals, min_deposit, is_active)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'TON', 'ton', NULL, 9, 0.1, true),
    ('22222222-2222-2222-2222-222222222222', 'USDT', 'ton', 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', 6, 1.0, true),
    ('33333333-3333-3333-3333-333333333333', 'USDT', 'tron', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 6, 1.0, true)
ON CONFLICT (symbol, network_id) DO NOTHING;

-- Services
INSERT INTO services (id, code, title, description, price_usd, is_active)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'VIP_1M', 'اشتراک طلایی ۱ ماهه', 'دسترسی کامل ۱ ماهه به سرویس اختصاصی', 5.0000, true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'VIP_3M', 'اشتراک طلایی ۳ ماهه', 'دسترسی کامل ۳ ماهه همراه با تخفیف ویژه', 12.0000, true),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'WALLET_CREDIT_10', 'شارژ حساب ۱۰ دلاری', 'افزایش موجودی حساب کاربری به میزان ۱۰ دلار', 10.0000, true)
ON CONFLICT (code) DO NOTHING;
