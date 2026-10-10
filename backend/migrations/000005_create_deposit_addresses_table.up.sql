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
