package postgres

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"wallet-observer/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DepositAddressRepository struct {
	pool *pgxpool.Pool
}

func NewDepositAddressRepository(pool *pgxpool.Pool) *DepositAddressRepository {
	return &DepositAddressRepository{pool: pool}
}

func (r *DepositAddressRepository) AssignAddress(ctx context.Context, networkID string, userID *string) (*domain.DepositAddress, error) {
	// For TON: Master treasury wallet + unique memo
	centralTonWallet := "EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N"
	memoBytes := make([]byte, 4)
	_, _ = rand.Read(memoBytes)
	uniqueMemo := fmt.Sprintf("ORD-%s", hex.EncodeToString(memoBytes))

	addr := &domain.DepositAddress{
		NetworkID:  networkID,
		Address:    centralTonWallet,
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
		return nil, fmt.Errorf("failed to record assigned address: %w", err)
	}

	return addr, nil
}
