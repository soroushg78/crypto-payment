package postgres

import (
	"context"
	"errors"
	"fmt"

	"wallet-observer/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CurrencyRepository struct {
	pool *pgxpool.Pool
}

func NewCurrencyRepository(pool *pgxpool.Pool) *CurrencyRepository {
	return &CurrencyRepository{pool: pool}
}

func (r *CurrencyRepository) ListByNetwork(ctx context.Context, networkID string) ([]*domain.Currency, error) {
	query := `SELECT id, symbol, network_id, contract_address, decimals, min_deposit, is_active FROM currencies WHERE network_id = $1 AND is_active = true`
	rows, err := r.pool.Query(ctx, query, networkID)
	if err != nil {
		return nil, fmt.Errorf("failed to list currencies: %w", err)
	}
	defer rows.Close()

	var currencies []*domain.Currency
	for rows.Next() {
		var c domain.Currency
		if err := rows.Scan(&c.ID, &c.Symbol, &c.NetworkID, &c.ContractAddress, &c.Decimals, &c.MinDeposit, &c.IsActive); err != nil {
			return nil, err
		}
		currencies = append(currencies, &c)
	}
	return currencies, nil
}

func (r *CurrencyRepository) GetByID(ctx context.Context, id string) (*domain.Currency, error) {
	query := `SELECT id, symbol, network_id, contract_address, decimals, min_deposit, is_active FROM currencies WHERE id = $1`
	var c domain.Currency
	err := r.pool.QueryRow(ctx, query, id).Scan(&c.ID, &c.Symbol, &c.NetworkID, &c.ContractAddress, &c.Decimals, &c.MinDeposit, &c.IsActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &c, nil
}
