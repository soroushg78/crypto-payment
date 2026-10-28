package database

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
)

// SyncNetworkMode synchronizes RPC endpoints and token contracts based on IS_TESTNET
func SyncNetworkMode(ctx context.Context, pool *pgxpool.Pool, isTestnet bool) error {
	var query string
	if isTestnet {
		query = `
			UPDATE networks SET is_testnet = true, rpc_endpoint = 'https://bsc-testnet.publicnode.com' WHERE id = 'bsc';
			UPDATE networks SET is_testnet = true, rpc_endpoint = 'https://testnet.toncenter.com/api/v2' WHERE id = 'ton';
			UPDATE networks SET is_testnet = true, rpc_endpoint = 'https://ethereum-sepolia.publicnode.com' WHERE id = 'eth';
			UPDATE currencies SET contract_address = '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd' WHERE network_id = 'bsc' AND symbol = 'USDT';
			UPDATE currencies SET contract_address = '0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0' WHERE network_id = 'eth' AND symbol = 'USDT';
		`
	} else {
		query = `
			UPDATE networks SET is_testnet = false, rpc_endpoint = 'https://bsc-dataseed.binance.org' WHERE id = 'bsc';
			UPDATE networks SET is_testnet = false, rpc_endpoint = 'https://toncenter.com/api/v2' WHERE id = 'ton';
			UPDATE networks SET is_testnet = false, rpc_endpoint = 'https://eth.llamarpc.com' WHERE id = 'eth';
			UPDATE currencies SET contract_address = '0x55d398326f99059fF775485246999027B3197955' WHERE network_id = 'bsc' AND symbol = 'USDT';
			UPDATE currencies SET contract_address = '0xdAC17F958D2ee523a2206206994597C13D831ec7' WHERE network_id = 'eth' AND symbol = 'USDT';
		`
	}

	if _, err := pool.Exec(ctx, query); err != nil {
		return fmt.Errorf("failed syncing network mode: %w", err)
	}

	if isTestnet {
		slog.Info("Database synced: TESTNET MODE ACTIVE (Free Test Faucet Coins)")
	} else {
		slog.Info("Database synced: MAINNET MODE ACTIVE (Real Assets)")
	}
	return nil
}

