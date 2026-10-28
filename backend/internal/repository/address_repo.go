package repository

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"time"

	"wallet-observer/internal/domain"
	"wallet-observer/pkg/hdwallet"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DepositAddressRepository struct {
	pool      *pgxpool.Pool
	hdManager *hdwallet.Manager
}

func NewDepositAddressRepository(pool *pgxpool.Pool, hdManager *hdwallet.Manager) *DepositAddressRepository {
	return &DepositAddressRepository{
		pool:      pool,
		hdManager: hdManager,
	}
}

func (r *DepositAddressRepository) AssignAddress(ctx context.Context, networkID string, userID *string) (*domain.DepositAddress, error) {
	if networkID == "bsc" || networkID == "eth" {
		// 1. Calculate next derivation index deterministically (starting at index 1; index 0 is reserved for Master Gas Station)
		var nextIndex int
		err := r.pool.QueryRow(ctx, "SELECT COALESCE(MAX(derivation_index), 0) + 1 FROM deposit_addresses WHERE network_id = $1 AND derivation_index > 0", networkID).Scan(&nextIndex)
		if err != nil || nextIndex < 1 {
			nextIndex = 1
		}

		// 2. Derive unique EVM address at index (m/44'/60'/0'/0/{index}) - Standard for both BSC and ETH
		evmAddress, err := r.hdManager.DeriveAddress(nextIndex)
		if err != nil {
			return nil, fmt.Errorf("failed to derive %s address at index %d: %w", networkID, nextIndex, err)
		}

		addr := &domain.DepositAddress{
			UserID:          userID,
			NetworkID:       networkID,
			Address:         evmAddress,
			DerivationIndex: &nextIndex,
			IsAssigned:      true,
			CreatedAt:       time.Now(),
		}

		query := `
			INSERT INTO deposit_addresses (user_id, network_id, address, derivation_index, is_assigned)
			VALUES ($1, $2, $3, $4, true)
			RETURNING id, created_at
		`
		err = r.pool.QueryRow(ctx, query, userID, networkID, addr.Address, addr.DerivationIndex).Scan(&addr.ID, &addr.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to record assigned %s address: %w", networkID, err)
		}

		return addr, nil
	}

	// Default / TON: Single Master Treasury Wallet + Unique Memo
	treasuryWallet := os.Getenv("TON_TREASURY_WALLET")
	if treasuryWallet == "" {
		treasuryWallet = "UQDRW1hBJ7uPVffzd_AGaB4DS0LNNp0WfVGO0k03DqQmUHWX"
	}
	memoBytes := make([]byte, 4)
	_, _ = rand.Read(memoBytes)
	uniqueMemo := fmt.Sprintf("ORD-%s", hex.EncodeToString(memoBytes))

	addr := &domain.DepositAddress{
		UserID:     userID,
		NetworkID:  networkID,
		Address:    treasuryWallet,
		Memo:       &uniqueMemo,
		IsAssigned: true,
		CreatedAt:  time.Now(),
	}

	query := `
		INSERT INTO deposit_addresses (user_id, network_id, address, memo, is_assigned)
		VALUES ($1, $2, $3, $4, true)
		RETURNING id, created_at
	`
	err := r.pool.QueryRow(ctx, query, userID, networkID, addr.Address, addr.Memo).Scan(&addr.ID, &addr.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to record assigned TON address: %w", err)
	}

	return addr, nil
}

func (r *DepositAddressRepository) ListAssigned(ctx context.Context, networkID string) ([]*domain.DepositAddress, error) {
	query := `
		SELECT id, user_id, network_id, address, memo, derivation_index, is_assigned, created_at
		FROM deposit_addresses
		WHERE network_id = $1 AND is_assigned = true AND (derivation_index IS NULL OR derivation_index > 0)
		ORDER BY derivation_index ASC NULLS LAST, created_at DESC
	`
	rows, err := r.pool.Query(ctx, query, networkID)
	if err != nil {
		return nil, fmt.Errorf("failed to list assigned deposit addresses: %w", err)
	}
	defer rows.Close()

	var result []*domain.DepositAddress
	for rows.Next() {
		var a domain.DepositAddress
		err := rows.Scan(
			&a.ID,
			&a.UserID,
			&a.NetworkID,
			&a.Address,
			&a.Memo,
			&a.DerivationIndex,
			&a.IsAssigned,
			&a.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan deposit address: %w", err)
		}
		result = append(result, &a)
	}

	return result, nil
}
