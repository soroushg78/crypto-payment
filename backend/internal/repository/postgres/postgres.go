package postgres

import (
	"context"
	"fmt"
	"log/slog"
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

	-- Drop legacy services table and service_id column if still existing
	ALTER TABLE invoices DROP COLUMN IF EXISTS service_id CASCADE;
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

	-- Ensure index 0 in BSC is strictly reserved for Master Gas Station and removed from invoice addresses
	DELETE FROM observed_transactions WHERE invoice_id IN (
		SELECT id FROM invoices WHERE pay_address IN (
			SELECT address FROM deposit_addresses WHERE network_id = 'bsc' AND derivation_index = 0
		)
	);
	DELETE FROM invoices WHERE pay_address IN (
		SELECT address FROM deposit_addresses WHERE network_id = 'bsc' AND derivation_index = 0
	);
	DELETE FROM deposit_addresses WHERE network_id = 'bsc' AND derivation_index = 0;

	-- Seed actual supported networks (TON & BSC)
	INSERT INTO networks (id, name, native_currency, rpc_endpoint, is_testnet, is_active)
	VALUES 
		('ton', 'The Open Network (TON)', 'TON', 'https://ton.org/global.config.json', false, true),
		('bsc', 'BNB Smart Chain (BSC)', 'BNB', 'https://bsc-dataseed.binance.org', false, true)
	ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, native_currency = EXCLUDED.native_currency, rpc_endpoint = EXCLUDED.rpc_endpoint;

	-- Clean up legacy mock currency UUIDs (like 11111111-...)
	DELETE FROM currencies WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');

	-- Seed actual supported currencies (TON on ton, BNB on bsc, USDT on bsc)
	INSERT INTO currencies (symbol, network_id, contract_address, decimals, min_deposit, is_active)
	VALUES 
		('TON', 'ton', NULL, 9, 0.1, true),
		('BNB', 'bsc', NULL, 18, 0.001, true),
		('USDT', 'bsc', '0x55d398326f99059fF775485246999027B3197955', 18, 1.0, true)
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

	// Seed default super admin (admin / admin123) with real bcrypt hash
	var adminExists bool
	_ = pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM admins WHERE username = 'admin')").Scan(&adminExists)
	if !adminExists {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		if err == nil {
			_, _ = pool.Exec(ctx,
				"INSERT INTO admins (username, password_hash, role) VALUES ($1, $2, 'SUPER_ADMIN')",
				"admin", string(hashedPassword),
			)
			slog.Info("Default super admin seeded (username: admin, password: admin123)")
		}
	}

	slog.Info("All database tables, constraints, admins, and supported networks/currencies initialized successfully")
	return nil
}
