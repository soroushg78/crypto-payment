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
