package repository

import (
	"context"
	"fmt"
	"time"

	"wallet-observer/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

type RebalanceRecordRepository struct {
	pool *pgxpool.Pool
}

func NewRebalanceRecordRepository(pool *pgxpool.Pool) *RebalanceRecordRepository {
	return &RebalanceRecordRepository{pool: pool}
}

func (r *RebalanceRecordRepository) Create(ctx context.Context, record *domain.RebalanceRecord) error {
	query := `
		INSERT INTO rebalance_records (
			network_id, derivation_index, from_address, to_address,
			asset, amount, gas_fee_bnb, tx_hash, status, is_simulated,
			error_message, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
		)
		RETURNING id, created_at
	`
	if record.CreatedAt.IsZero() {
		record.CreatedAt = time.Now()
	}

	err := r.pool.QueryRow(ctx, query,
		record.NetworkID,
		record.DerivationIndex,
		record.FromAddress,
		record.ToAddress,
		record.Asset,
		record.Amount,
		record.GasFeeBNB,
		record.TxHash,
		record.Status,
		record.IsSimulated,
		record.ErrorMessage,
		record.CreatedAt,
	).Scan(&record.ID, &record.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to insert rebalance record: %w", err)
	}
	return nil
}

func (r *RebalanceRecordRepository) ListAll(ctx context.Context, limit int) ([]*domain.RebalanceRecord, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	query := `
		SELECT id, network_id, derivation_index, from_address, to_address,
		       asset, amount, gas_fee_bnb, tx_hash, status, is_simulated,
		       error_message, created_at
		FROM rebalance_records
		ORDER BY created_at DESC
		LIMIT $1
	`

	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list rebalance records: %w", err)
	}
	defer rows.Close()

	var records []*domain.RebalanceRecord
	for rows.Next() {
		var rec domain.RebalanceRecord
		err := rows.Scan(
			&rec.ID,
			&rec.NetworkID,
			&rec.DerivationIndex,
			&rec.FromAddress,
			&rec.ToAddress,
			&rec.Asset,
			&rec.Amount,
			&rec.GasFeeBNB,
			&rec.TxHash,
			&rec.Status,
			&rec.IsSimulated,
			&rec.ErrorMessage,
			&rec.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan rebalance record: %w", err)
		}
		records = append(records, &rec)
	}

	return records, nil
}
