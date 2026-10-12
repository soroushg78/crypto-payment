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
