package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"wallet-observer/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type InvoiceRepository struct {
	pool *pgxpool.Pool
}

func NewInvoiceRepository(pool *pgxpool.Pool) *InvoiceRepository {
	return &InvoiceRepository{pool: pool}
}

func (r *InvoiceRepository) Create(ctx context.Context, inv *domain.Invoice) error {
	query := `
		INSERT INTO invoices (
			invoice_number, user_id, service_id, currency_id, network_id,
			amount_usd, crypto_amount, exchange_rate, pay_address, pay_memo,
			status, expires_at, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
		)
		RETURNING id, created_at, updated_at
	`
	err := r.pool.QueryRow(ctx, query,
		inv.InvoiceNumber, inv.UserID, inv.ServiceID, inv.CurrencyID, inv.NetworkID,
		inv.AmountUSD, inv.CryptoAmount, inv.ExchangeRate, inv.PayAddress, inv.PayMemo,
		string(inv.Status), inv.ExpiresAt, inv.CreatedAt, inv.UpdatedAt,
	).Scan(&inv.ID, &inv.CreatedAt, &inv.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to insert invoice: %w", err)
	}
	return nil
}

func (r *InvoiceRepository) GetByID(ctx context.Context, id string) (*domain.Invoice, error) {
	query := `
		SELECT i.id, i.invoice_number, i.user_id, i.service_id, i.currency_id, i.network_id,
		       i.amount_usd, i.crypto_amount, i.exchange_rate, i.pay_address, i.pay_memo,
		       i.status, i.expires_at, i.paid_at, i.created_at, i.updated_at,
		       s.title, c.symbol, n.name
		FROM invoices i
		LEFT JOIN services s ON i.service_id = s.id
		LEFT JOIN currencies c ON i.currency_id = c.id
		LEFT JOIN networks n ON i.network_id = n.id
		WHERE i.id = $1
	`
	return r.scanInvoice(r.pool.QueryRow(ctx, query, id))
}

func (r *InvoiceRepository) GetByNumber(ctx context.Context, number string) (*domain.Invoice, error) {
	query := `
		SELECT i.id, i.invoice_number, i.user_id, i.service_id, i.currency_id, i.network_id,
		       i.amount_usd, i.crypto_amount, i.exchange_rate, i.pay_address, i.pay_memo,
		       i.status, i.expires_at, i.paid_at, i.created_at, i.updated_at,
		       s.title, c.symbol, n.name
		FROM invoices i
		LEFT JOIN services s ON i.service_id = s.id
		LEFT JOIN currencies c ON i.currency_id = c.id
		LEFT JOIN networks n ON i.network_id = n.id
		WHERE i.invoice_number = $1
	`
	return r.scanInvoice(r.pool.QueryRow(ctx, query, number))
}

func (r *InvoiceRepository) UpdateStatus(ctx context.Context, id string, status domain.InvoiceStatus, paidAt *time.Time) error {
	query := `
		UPDATE invoices 
		SET status = $1, paid_at = $2, updated_at = NOW() 
		WHERE id = $3
	`
	tag, err := r.pool.Exec(ctx, query, string(status), paidAt, id)
	if err != nil {
		return fmt.Errorf("failed to update invoice status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *InvoiceRepository) ListPending(ctx context.Context) ([]*domain.Invoice, error) {
	query := `
		SELECT i.id, i.invoice_number, i.user_id, i.service_id, i.currency_id, i.network_id,
		       i.amount_usd, i.crypto_amount, i.exchange_rate, i.pay_address, i.pay_memo,
		       i.status, i.expires_at, i.paid_at, i.created_at, i.updated_at,
		       s.title, c.symbol, n.name
		FROM invoices i
		LEFT JOIN services s ON i.service_id = s.id
		LEFT JOIN currencies c ON i.currency_id = c.id
		LEFT JOIN networks n ON i.network_id = n.id
		WHERE i.status = 'PENDING' AND i.expires_at > NOW()
		ORDER BY i.created_at ASC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list pending invoices: %w", err)
	}
	defer rows.Close()

	var invoices []*domain.Invoice
	for rows.Next() {
		var inv domain.Invoice
		var statusStr string
		var serviceTitle, currSymbol, netName *string

		err := rows.Scan(
			&inv.ID, &inv.InvoiceNumber, &inv.UserID, &inv.ServiceID, &inv.CurrencyID, &inv.NetworkID,
			&inv.AmountUSD, &inv.CryptoAmount, &inv.ExchangeRate, &inv.PayAddress, &inv.PayMemo,
			&statusStr, &inv.ExpiresAt, &inv.PaidAt, &inv.CreatedAt, &inv.UpdatedAt,
			&serviceTitle, &currSymbol, &netName,
		)
		if err != nil {
			return nil, err
		}

		inv.Status = domain.InvoiceStatus(statusStr)
		if serviceTitle != nil {
			inv.ServiceTitle = *serviceTitle
		}
		if currSymbol != nil {
			inv.CurrencySymbol = *currSymbol
		}
		if netName != nil {
			inv.NetworkName = *netName
		}
		invoices = append(invoices, &inv)
	}
	return invoices, nil
}

func (r *InvoiceRepository) scanInvoice(row pgx.Row) (*domain.Invoice, error) {
	var inv domain.Invoice
	var statusStr string
	var serviceTitle, currSymbol, netName *string

	err := row.Scan(
		&inv.ID, &inv.InvoiceNumber, &inv.UserID, &inv.ServiceID, &inv.CurrencyID, &inv.NetworkID,
		&inv.AmountUSD, &inv.CryptoAmount, &inv.ExchangeRate, &inv.PayAddress, &inv.PayMemo,
		&statusStr, &inv.ExpiresAt, &inv.PaidAt, &inv.CreatedAt, &inv.UpdatedAt,
		&serviceTitle, &currSymbol, &netName,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("scan invoice error: %w", err)
	}

	inv.Status = domain.InvoiceStatus(statusStr)
	if serviceTitle != nil {
		inv.ServiceTitle = *serviceTitle
	}
	if currSymbol != nil {
		inv.CurrencySymbol = *currSymbol
	}
	if netName != nil {
		inv.NetworkName = *netName
	}
	return &inv, nil
}
