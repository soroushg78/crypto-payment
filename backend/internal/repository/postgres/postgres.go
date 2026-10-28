package postgres

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"wallet-observer/internal/config"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// NewPool initializes a PostgreSQL connection pool with connection settings.
func NewPool(ctx context.Context, cfg config.DatabaseConfig) (*pgxpool.Pool, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse database config: %w", err)
	}

	poolConfig.MaxConns = cfg.MaxConns
	poolConfig.MinConns = cfg.MinConns
	poolConfig.MaxConnLifetime = cfg.MaxConnLifetime
	poolConfig.MaxConnIdleTime = cfg.MaxConnIdleTime

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	// Verify connection with a short timeout
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("database ping failed: %w", err)
	}

	slog.Info("PostgreSQL connection pool established successfully")
	return pool, nil
}

// AutoMigrate ensures all core tables, constraints, indexes, and seed data are initialized.
func AutoMigrate(ctx context.Context, pool *pgxpool.Pool) error {
	query := `
	-- 1. Users Table (Web and Telegram)
	CREATE TABLE IF NOT EXISTS users (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		telegram_id BIGINT UNIQUE,
		username VARCHAR(128),
		first_name VARCHAR(128),
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	-- Drop legacy services table if still existing
	DROP TABLE IF EXISTS services CASCADE;

	-- 2. Networks Table (Blockchain Networks)
	CREATE TABLE IF NOT EXISTS networks (
		id VARCHAR(32) PRIMARY KEY,
		name VARCHAR(128) NOT NULL,
		native_currency VARCHAR(16) NOT NULL,
		rpc_endpoint TEXT,
		is_testnet BOOLEAN NOT NULL DEFAULT FALSE,
		is_active BOOLEAN NOT NULL DEFAULT TRUE
	);

	-- 3. Currencies Table (Tokens & Coins)
	CREATE TABLE IF NOT EXISTS currencies (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		symbol VARCHAR(16) NOT NULL,
		network_id VARCHAR(32) NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
		contract_address VARCHAR(128),
		decimals INT NOT NULL DEFAULT 9,
		min_deposit NUMERIC(36, 18) NOT NULL DEFAULT 0.000000001,
		is_active BOOLEAN NOT NULL DEFAULT TRUE,
		CONSTRAINT uq_symbol_network UNIQUE (symbol, network_id)
	);

	-- 4. Deposit Addresses Table
	CREATE TABLE IF NOT EXISTS deposit_addresses (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id UUID REFERENCES users(id) ON DELETE SET NULL,
		network_id VARCHAR(32) NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
		address TEXT NOT NULL,
		memo VARCHAR(128),
		derivation_index INT,
		is_assigned BOOLEAN NOT NULL DEFAULT FALSE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_deposit_addr ON deposit_addresses(network_id, address);
	CREATE INDEX IF NOT EXISTS idx_deposit_network_index ON deposit_addresses(network_id, derivation_index);

	-- 5. Invoices Table (Orders)
	CREATE TABLE IF NOT EXISTS invoices (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		invoice_number VARCHAR(64) UNIQUE NOT NULL,
		user_id UUID REFERENCES users(id) ON DELETE SET NULL,
		currency_id UUID REFERENCES currencies(id) ON DELETE RESTRICT,
		network_id VARCHAR(32) NOT NULL REFERENCES networks(id) ON DELETE RESTRICT,
		amount_usd NUMERIC(18, 4) NOT NULL,
		crypto_amount NUMERIC(36, 18) NOT NULL,
		exchange_rate NUMERIC(18, 8) NOT NULL,
		pay_address TEXT NOT NULL,
		pay_memo VARCHAR(128),
		status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
		expires_at TIMESTAMPTZ NOT NULL,
		paid_at TIMESTAMPTZ,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
	CREATE INDEX IF NOT EXISTS idx_invoices_expires_at ON invoices(expires_at);
	CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
	DROP INDEX IF EXISTS idx_invoices_order_id;
	ALTER TABLE invoices DROP COLUMN IF EXISTS order_id;
	ALTER TABLE invoices DROP COLUMN IF EXISTS callback_url;
	ALTER TABLE invoices DROP COLUMN IF EXISTS service_id CASCADE;

	-- 6. Observed Transactions Table (Double-Spend Prevention)
	CREATE TABLE IF NOT EXISTS observed_transactions (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
		network_id VARCHAR(32) NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
		tx_hash TEXT NOT NULL,
		from_address TEXT,
		to_address TEXT,
		amount NUMERIC(36, 18) NOT NULL,
		memo TEXT,
		block_number BIGINT,
		confirmations INT NOT NULL DEFAULT 1,
		status VARCHAR(32) NOT NULL DEFAULT 'DETECTED',
		detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		confirmed_at TIMESTAMPTZ,
		CONSTRAINT uq_network_tx_hash UNIQUE(network_id, tx_hash)
	);
	CREATE INDEX IF NOT EXISTS idx_tx_to_address ON observed_transactions(to_address);
	CREATE INDEX IF NOT EXISTS idx_tx_memo ON observed_transactions(memo);

	-- 7. Admins Table (Management Authentication)
	CREATE TABLE IF NOT EXISTS admins (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		username VARCHAR(64) UNIQUE NOT NULL,
		password_hash VARCHAR(255) NOT NULL,
		role VARCHAR(32) NOT NULL DEFAULT 'SUPER_ADMIN',
		telegram_id BIGINT UNIQUE,
		is_active BOOLEAN NOT NULL DEFAULT TRUE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		last_login_at TIMESTAMPTZ
	);
	CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);

	-- 8. Rebalance Records Table (Audit Trail & Sweeping History)
	CREATE TABLE IF NOT EXISTS rebalance_records (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		network_id VARCHAR(32) NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
		derivation_index INT,
		from_address TEXT NOT NULL,
		to_address TEXT NOT NULL,
		asset VARCHAR(16) NOT NULL,
		amount NUMERIC(36, 18) NOT NULL,
		gas_fee_bnb NUMERIC(36, 18) NOT NULL DEFAULT 0,
		tx_hash TEXT,
		status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
		is_simulated BOOLEAN NOT NULL DEFAULT FALSE,
		error_message TEXT,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_rebalance_records_created_at ON rebalance_records(created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_rebalance_records_network ON rebalance_records(network_id);

	-- Clean up all fake / mock / simulated rebalance records
	DELETE FROM rebalance_records WHERE is_simulated = TRUE;

	-- Clean up legacy TRON and TON-USDT test invoices/transactions
	DELETE FROM observed_transactions WHERE network_id = 'tron' OR invoice_id IN (
		SELECT id FROM invoices WHERE network_id = 'tron' OR currency_id IN (
			SELECT id FROM currencies WHERE network_id = 'tron' OR (network_id = 'ton' AND symbol = 'USDT')
		)
	);
	DELETE FROM invoices WHERE network_id = 'tron' OR currency_id IN (
		SELECT id FROM currencies WHERE network_id = 'tron' OR (network_id = 'ton' AND symbol = 'USDT')
	);
	DELETE FROM deposit_addresses WHERE network_id = 'tron';
	DELETE FROM currencies WHERE network_id = 'tron';
	DELETE FROM currencies WHERE network_id = 'ton' AND symbol = 'USDT';
	DELETE FROM networks WHERE id = 'tron';

	-- Ensure index 0 in BSC/ETH is strictly reserved for Master Gas Station
	DELETE FROM observed_transactions WHERE invoice_id IN (
		SELECT id FROM invoices WHERE pay_address IN (
			SELECT address FROM deposit_addresses WHERE (network_id = 'bsc' OR network_id = 'eth') AND derivation_index = 0
		)
	);
	DELETE FROM invoices WHERE pay_address IN (
		SELECT address FROM deposit_addresses WHERE (network_id = 'bsc' OR network_id = 'eth') AND derivation_index = 0
	);
	DELETE FROM deposit_addresses WHERE (network_id = 'bsc' OR network_id = 'eth') AND derivation_index = 0;

	-- Migrate legacy TON currency completely to GRAM
	UPDATE networks SET native_currency = 'GRAM' WHERE id = 'ton';
	UPDATE currencies SET symbol = 'GRAM' WHERE network_id = 'ton' AND symbol = 'TON';
	DELETE FROM currencies WHERE network_id = 'ton' AND symbol = 'TON';

	-- Seed actual supported networks (TON, BSC, ETH)
	INSERT INTO networks (id, name, native_currency, rpc_endpoint, is_testnet, is_active)
	VALUES 
		('ton', 'The Open Network (TON)', 'GRAM', 'https://toncenter.com/api/v2', false, true),
		('bsc', 'BNB Smart Chain (BSC)', 'BNB', 'https://bsc-dataseed.binance.org', false, true),
		('eth', 'Ethereum (ETH)', 'ETH', 'https://eth.llamarpc.com', false, true)
	ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, native_currency = EXCLUDED.native_currency, rpc_endpoint = EXCLUDED.rpc_endpoint;

	-- Clean up legacy mock currency UUIDs (like 11111111-...)
	DELETE FROM currencies WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');

	-- Seed actual supported currencies (GRAM on ton, BNB/USDT on bsc, ETH/USDT on eth)
	INSERT INTO currencies (symbol, network_id, contract_address, decimals, min_deposit, is_active)
	VALUES 
		('GRAM', 'ton', NULL, 9, 0.1, true),
		('BNB', 'bsc', NULL, 18, 0.001, true),
		('USDT', 'bsc', '0x55d398326f99059fF775485246999027B3197955', 18, 1.0, true),
		('ETH', 'eth', NULL, 18, 0.001, true),
		('USDT', 'eth', '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 5.0, true)
	ON CONFLICT (symbol, network_id) DO NOTHING;

	-- Seed Telegram user @babasoroush
	INSERT INTO users (telegram_id, username, first_name)
	VALUES (987654321, 'babasoroush', 'Soroush')
	ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username;
	`
	_, err := pool.Exec(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	// Dynamic Testnet Mode synchronization (Free Testnet Coins vs Real Mainnet)
	isTestnet := os.Getenv("IS_TESTNET") == "true"
	if isTestnet {
		_, _ = pool.Exec(ctx, `
			UPDATE networks SET is_testnet = true, rpc_endpoint = 'https://bsc-testnet.publicnode.com' WHERE id = 'bsc';
			UPDATE networks SET is_testnet = true, rpc_endpoint = 'https://testnet.toncenter.com/api/v2' WHERE id = 'ton';
			UPDATE networks SET is_testnet = true, rpc_endpoint = 'https://ethereum-sepolia.publicnode.com' WHERE id = 'eth';
			UPDATE currencies SET contract_address = '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd' WHERE network_id = 'bsc' AND symbol = 'USDT';
			UPDATE currencies SET contract_address = '0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0' WHERE network_id = 'eth' AND symbol = 'USDT';
		`)
		slog.Info("Database synced: TESTNET MODE ACTIVE (Free Test Faucet Coins)")
	} else {
		_, _ = pool.Exec(ctx, `
			UPDATE networks SET is_testnet = false, rpc_endpoint = 'https://bsc-dataseed.binance.org' WHERE id = 'bsc';
			UPDATE networks SET is_testnet = false, rpc_endpoint = 'https://toncenter.com/api/v2' WHERE id = 'ton';
			UPDATE networks SET is_testnet = false, rpc_endpoint = 'https://eth.llamarpc.com' WHERE id = 'eth';
			UPDATE currencies SET contract_address = '0x55d398326f99059fF775485246999027B3197955' WHERE network_id = 'bsc' AND symbol = 'USDT';
			UPDATE currencies SET contract_address = '0xdAC17F958D2ee523a2206206994597C13D831ec7' WHERE network_id = 'eth' AND symbol = 'USDT';
		`)
		slog.Info("Database synced: MAINNET MODE ACTIVE (Real Assets)")
	}

	// Seed super admin on fresh deployment ONLY if credentials provided in environment
	adminUsername := os.Getenv("ADMIN_USERNAME")
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminUsername != "" && adminPassword != "" {
		var adminExists bool
		_ = pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM admins WHERE username = $1)", adminUsername).Scan(&adminExists)
		if !adminExists {
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
			if err == nil {
				_, _ = pool.Exec(ctx,
					"INSERT INTO admins (username, password_hash, role) VALUES ($1, $2, 'SUPER_ADMIN')",
					adminUsername, string(hashedPassword),
				)
				slog.Info("Super admin seeded successfully into database", "username", adminUsername)
			}
		}
	}

	return nil
}
