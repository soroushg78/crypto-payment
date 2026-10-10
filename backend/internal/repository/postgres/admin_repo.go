package postgres

import (
	"context"
	"errors"
	"fmt"

	"wallet-observer/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AdminRepository struct {
	pool *pgxpool.Pool
}

func NewAdminRepository(pool *pgxpool.Pool) *AdminRepository {
	return &AdminRepository{pool: pool}
}

func (r *AdminRepository) GetByUsername(ctx context.Context, username string) (*domain.Admin, string, error) {
	query := `
		SELECT id, username, password_hash, role, telegram_id, is_active, created_at, last_login_at
		FROM admins
		WHERE username = $1
	`
	var a domain.Admin
	var hash string
	err := r.pool.QueryRow(ctx, query, username).Scan(
		&a.ID,
		&a.Username,
		&hash,
		&a.Role,
		&a.TelegramID,
		&a.IsActive,
		&a.CreatedAt,
		&a.LastLoginAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, "", domain.ErrNotFound
		}
		return nil, "", fmt.Errorf("failed to fetch admin: %w", err)
	}

	return &a, hash, nil
}

func (r *AdminRepository) UpdateLastLogin(ctx context.Context, id string) error {
	query := `UPDATE admins SET last_login_at = NOW() WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}
