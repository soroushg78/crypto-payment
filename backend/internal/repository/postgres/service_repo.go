package postgres

import (
	"context"
	"errors"
	"fmt"

	"wallet-observer/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ServiceRepository struct {
	pool *pgxpool.Pool
}

func NewServiceRepository(pool *pgxpool.Pool) *ServiceRepository {
	return &ServiceRepository{pool: pool}
}

func (r *ServiceRepository) ListActive(ctx context.Context) ([]*domain.Service, error) {
	query := `SELECT id, code, title, description, price_usd, is_active, created_at FROM services WHERE is_active = true ORDER BY price_usd ASC`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list active services: %w", err)
	}
	defer rows.Close()

	var services []*domain.Service
	for rows.Next() {
		var s domain.Service
		var desc *string
		if err := rows.Scan(&s.ID, &s.Code, &s.Title, &desc, &s.PriceUSD, &s.IsActive, &s.CreatedAt); err != nil {
			return nil, err
		}
		if desc != nil {
			s.Description = *desc
		}
		services = append(services, &s)
	}
	return services, nil
}

func (r *ServiceRepository) GetByID(ctx context.Context, id string) (*domain.Service, error) {
	query := `SELECT id, code, title, description, price_usd, is_active, created_at FROM services WHERE id = $1`
	var s domain.Service
	var desc *string
	err := r.pool.QueryRow(ctx, query, id).Scan(&s.ID, &s.Code, &s.Title, &desc, &s.PriceUSD, &s.IsActive, &s.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	if desc != nil {
		s.Description = *desc
	}
	return &s, nil
}
