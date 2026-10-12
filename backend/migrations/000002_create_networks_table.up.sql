CREATE TABLE IF NOT EXISTS networks (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    native_currency VARCHAR(16) NOT NULL,
    rpc_endpoint TEXT,
    is_testnet BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);
