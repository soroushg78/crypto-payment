package postgres

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"wallet-observer/internal/config"

	"github.com/jackc/pgx/v5/pgxpool"
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

	-- 2. Services Table (Products / Subscriptions)
	CREATE TABLE IF NOT EXISTS services (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		code VARCHAR(64) UNIQUE NOT NULL,
		title VARCHAR(255) NOT NULL,
		description TEXT,
		price_usd NUMERIC(18, 4) NOT NULL,
		is_active BOOLEAN NOT NULL DEFAULT TRUE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	-- 3. Networks Table (Blockchain Networks)
	CREATE TABLE IF NOT EXISTS networks (
		id VARCHAR(32) PRIMARY KEY,
		name VARCHAR(128) NOT NULL,
		native_currency VARCHAR(16) NOT NULL,
		rpc_endpoint TEXT,
		is_testnet BOOLEAN NOT NULL DEFAULT FALSE,
		is_active BOOLEAN NOT NULL DEFAULT TRUE
	);

	-- 4. Currencies Table (Tokens & Coins)
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

	-- 5. Deposit Addresses Table
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

	-- 6. Invoices Table (Orders)
	CREATE TABLE IF NOT EXISTS invoices (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		invoice_number VARCHAR(64) UNIQUE NOT NULL,
		user_id UUID REFERENCES users(id) ON DELETE SET NULL,
		service_id UUID REFERENCES services(id) ON DELETE RESTRICT,
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

	-- 7. Observed Transactions Table (Double-Spend Prevention)
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

	-- Seed default networks
	INSERT INTO networks (id, name, native_currency, rpc_endpoint, is_testnet, is_active)
	VALUES 
		('ton', 'The Open Network', 'TON', 'https://toncenter.com/api/v2/jsonRPC', false, true),
		('tron', 'TRON Network', 'TRX', 'https://api.trongrid.io', false, true)
	ON CONFLICT (id) DO NOTHING;

	-- Seed default currencies
	INSERT INTO currencies (id, symbol, network_id, contract_address, decimals, min_deposit, is_active)
	VALUES 
		('11111111-1111-1111-1111-111111111111', 'TON', 'ton', NULL, 9, 0.1, true),
		('22222222-2222-2222-2222-222222222222', 'USDT', 'ton', 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', 6, 1.0, true),
		('33333333-3333-3333-3333-333333333333', 'USDT', 'tron', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 6, 1.0, true)
	ON CONFLICT (symbol, network_id) DO NOTHING;

	-- Seed default services
	INSERT INTO services (id, code, title, description, price_usd, is_active)
	VALUES 
		('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'VIP_1M', 'اشتراک طلایی ۱ ماهه', 'دسترسی کامل ۱ ماهه به سرویس اختصاصی', 5.0000, true),
		('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'VIP_3M', 'اشتراک طلایی ۳ ماهه', 'دسترسی کامل ۳ ماهه همراه با تخفیف ویژه', 12.0000, true),
		('cccccccc-cccc-cccc-cccc-cccccccccccc', 'WALLET_CREDIT_10', 'شارژ حساب ۱۰ دلاری', 'افزایش موجودی حساب کاربری به میزان ۱۰ دلار', 10.0000, true)
	ON CONFLICT (code) DO NOTHING;
	`
	_, err := pool.Exec(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}
	slog.Info("All database tables, constraints, and seed data initialized successfully")
	return nil
}
