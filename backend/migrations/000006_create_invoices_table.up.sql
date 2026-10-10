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
