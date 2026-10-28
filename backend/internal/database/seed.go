package database

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
)

// SeedInitialData seeds default networks, currencies, system users and admin
func SeedInitialData(ctx context.Context, pool *pgxpool.Pool) error {
	seedQuery := `
	-- 1. Ensure Index 0 on BSC/ETH is strictly reserved for Master Gas Station
	DELETE FROM observed_transactions WHERE invoice_id IN (
		SELECT id FROM invoices WHERE pay_address IN (
			SELECT address FROM deposit_addresses WHERE (network_id = 'bsc' OR network_id = 'eth') AND derivation_index = 0
		)
	);
	DELETE FROM invoices WHERE pay_address IN (
		SELECT address FROM deposit_addresses WHERE (network_id = 'bsc' OR network_id = 'eth') AND derivation_index = 0
	);
	DELETE FROM deposit_addresses WHERE (network_id = 'bsc' OR network_id = 'eth') AND derivation_index = 0;

	-- 2. Clean up any simulated rebalance test records
	DELETE FROM rebalance_records WHERE is_simulated = TRUE;

	-- 3. Migrate legacy TON currency to GRAM
	UPDATE networks SET native_currency = 'GRAM' WHERE id = 'ton';
	UPDATE currencies SET symbol = 'GRAM' WHERE network_id = 'ton' AND symbol = 'TON';
	DELETE FROM currencies WHERE network_id = 'ton' AND symbol = 'TON';

	-- 4. Seed actual supported networks (TON, BSC, ETH)
	INSERT INTO networks (id, name, native_currency, rpc_endpoint, is_testnet, is_active)
	VALUES 
		('ton', 'The Open Network (TON)', 'GRAM', 'https://toncenter.com/api/v2', false, true),
		('bsc', 'BNB Smart Chain (BSC)', 'BNB', 'https://bsc-dataseed.binance.org', false, true),
		('eth', 'Ethereum (ETH)', 'ETH', 'https://eth.llamarpc.com', false, true)
	ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, native_currency = EXCLUDED.native_currency, rpc_endpoint = EXCLUDED.rpc_endpoint;

	-- 5. Seed actual supported currencies (GRAM on ton, BNB/USDT on bsc, ETH/USDT on eth)
	INSERT INTO currencies (symbol, network_id, contract_address, decimals, min_deposit, is_active)
	VALUES 
		('GRAM', 'ton', NULL, 9, 0.1, true),
		('BNB', 'bsc', NULL, 18, 0.001, true),
		('USDT', 'bsc', '0x55d398326f99059fF775485246999027B3197955', 18, 1.0, true),
		('ETH', 'eth', NULL, 18, 0.001, true),
		('USDT', 'eth', '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 5.0, true)
	ON CONFLICT (symbol, network_id) DO NOTHING;

	-- 6. Seed Telegram User @babasoroush
	INSERT INTO users (telegram_id, username, first_name)
	VALUES (987654321, 'babasoroush', 'Soroush')
	ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username;

	-- 7. Seed Default Admin (admin / admin123 with bcrypt)
	INSERT INTO admins (username, password_hash, role)
	VALUES ('admin', '$2a$10$tZ2J9W24BvQzYhLskR0v.eH3uY4.h67PZgD0M4eXJ5i2Xb8fVqOq6', 'SUPER_ADMIN')
	ON CONFLICT (username) DO NOTHING;
	`

	if _, err := pool.Exec(ctx, seedQuery); err != nil {
		return fmt.Errorf("failed seeding initial database data: %w", err)
	}

	slog.Info("Database initial seeds applied successfully")
	return nil
}
