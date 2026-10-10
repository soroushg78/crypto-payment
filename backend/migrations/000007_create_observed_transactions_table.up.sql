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
