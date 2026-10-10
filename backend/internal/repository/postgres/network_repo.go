package postgres

import (
	"context"
	"errors"
	"fmt"

	"wallet-observer/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type NetworkRepository struct {
	pool *pgxpool.Pool
}

func NewNetworkRepository(pool *pgxpool.Pool) *NetworkRepository {
	return &NetworkRepository{pool: pool}
}

func (r *NetworkRepository) ListActive(ctx context.Context) ([]*domain.Network, error) {
	query := `SELECT id, name, native_currency, rpc_endpoint, is_testnet, is_active FROM networks WHERE is_active = true`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list networks: %w", err)
	}
	defer rows.Close()

	var networks []*domain.Network
	for rows.Next() {
		var n domain.Network
		var rpc *string
		if err := rows.Scan(&n.ID, &n.Name, &n.NativeCurrency, &rpc, &n.IsTestnet, &n.IsActive); err != nil {
			return nil, err
		}
		if rpc != nil {
			n.RPCEndpoint = *rpc
		}
		networks = append(networks, &n)
	}
	return networks, nil
}

func (r *NetworkRepository) GetByID(ctx context.Context, id string) (*domain.Network, error) {
	query := `SELECT id, name, native_currency, rpc_endpoint, is_testnet, is_active FROM networks WHERE id = $1`
	var n domain.Network
	var rpc *string
	err := r.pool.QueryRow(ctx, query, id).Scan(&n.ID, &n.Name, &n.NativeCurrency, &rpc, &n.IsTestnet, &n.IsActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	if rpc != nil {
		n.RPCEndpoint = *rpc
	}
	return &n, nil
}
