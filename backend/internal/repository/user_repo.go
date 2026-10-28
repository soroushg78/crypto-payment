package repository

import (
	"context"
	"errors"
	"fmt"

	"wallet-observer/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

func (r *UserRepository) GetOrCreateByTelegramID(ctx context.Context, telegramID int64, username, firstName string) (*domain.User, error) {
	query := `
		INSERT INTO users (telegram_id, username, first_name)
		VALUES ($1, $2, $3)
		ON CONFLICT (telegram_id) DO UPDATE 
		SET username = EXCLUDED.username, first_name = EXCLUDED.first_name
		RETURNING id, telegram_id, username, first_name, created_at
	`
	var u domain.User
	var tid int64
	var uname, fname *string
	err := r.pool.QueryRow(ctx, query, telegramID, username, firstName).Scan(&u.ID, &tid, &uname, &fname, &u.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to get or create user: %w", err)
	}
	u.TelegramID = &tid
	if uname != nil {
		u.Username = *uname
	}
	if fname != nil {
		u.FirstName = *fname
	}
	return &u, nil
}

func (r *UserRepository) GetByID(ctx context.Context, id string) (*domain.User, error) {
	query := `SELECT id, telegram_id, username, first_name, created_at FROM users WHERE id = $1`
	var u domain.User
	var tid *int64
	var uname, fname *string
	err := r.pool.QueryRow(ctx, query, id).Scan(&u.ID, &tid, &uname, &fname, &u.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	u.TelegramID = tid
	if uname != nil {
		u.Username = *uname
	}
	if fname != nil {
		u.FirstName = *fname
	}
	return &u, nil
}

func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*domain.User, error) {
	query := `SELECT id, telegram_id, username, first_name, created_at FROM users WHERE username = $1`
	var u domain.User
	var tid *int64
	var uname, fname *string
	err := r.pool.QueryRow(ctx, query, username).Scan(&u.ID, &tid, &uname, &fname, &u.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	u.TelegramID = tid
	if uname != nil {
		u.Username = *uname
	}
	if fname != nil {
		u.FirstName = *fname
	}
	return &u, nil
}

func (r *UserRepository) GetOrCreateByUsername(ctx context.Context, username, firstName string) (*domain.User, error) {
	// First check if exists
	existing, err := r.GetByUsername(ctx, username)
	if err == nil && existing != nil {
		return existing, nil
	}

	query := `
		INSERT INTO users (username, first_name)
		VALUES ($1, $2)
		RETURNING id, telegram_id, username, first_name, created_at
	`
	var u domain.User
	var tid *int64
	var uname, fname *string
	err = r.pool.QueryRow(ctx, query, username, firstName).Scan(&u.ID, &tid, &uname, &fname, &u.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create user by username: %w", err)
	}
	u.TelegramID = tid
	if uname != nil {
		u.Username = *uname
	}
	if fname != nil {
		u.FirstName = *fname
	}
	return &u, nil
}
