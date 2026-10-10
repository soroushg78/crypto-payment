package postgres

import (
	"context"
	"errors"
	"fmt"

	"wallet-observer/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ObservedTransactionRepository struct {
	pool *pgxpool.Pool
}

func NewObservedTransactionRepository(pool *pgxpool.Pool) *ObservedTransactionRepository {
	return &ObservedTransactionRepository{pool: pool}
}

func (r *ObservedTransactionRepository) RecordTransaction(ctx context.Context, tx *domain.ObservedTransaction) error {
	query := `
		INSERT INTO observed_transactions (
			invoice_id, network_id, tx_hash, from_address, to_address,
			amount, memo, block_number, confirmations, status, detected_at, confirmed_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
		)
		ON CONFLICT (network_id, tx_hash) DO NOTHING
		RETURNING id
	`
	err := r.pool.QueryRow(ctx, query,
		tx.InvoiceID, tx.NetworkID, tx.TxHash, tx.FromAddress, tx.ToAddress,
		tx.Amount, tx.Memo, tx.BlockNumber, tx.Confirmations, tx.Status, tx.DetectedAt, tx.ConfirmedAt,
	).Scan(&tx.ID)

	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("failed to record observed tx: %w", err)
	}
	return nil
}

func (r *ObservedTransactionRepository) Exists(ctx context.Context, networkID, txHash string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM observed_transactions WHERE network_id = $1 AND tx_hash = $2)`
	var exists bool
	err := r.pool.QueryRow(ctx, query, networkID, txHash).Scan(&exists)
	return exists, err
}
