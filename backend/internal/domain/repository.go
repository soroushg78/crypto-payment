package domain

import (
	"context"
	"time"
)

type ServiceRepository interface {
	ListActive(ctx context.Context) ([]*Service, error)
	GetByID(ctx context.Context, id string) (*Service, error)
}

type NetworkRepository interface {
	ListActive(ctx context.Context) ([]*Network, error)
	GetByID(ctx context.Context, id string) (*Network, error)
}

type CurrencyRepository interface {
	ListByNetwork(ctx context.Context, networkID string) ([]*Currency, error)
	GetByID(ctx context.Context, id string) (*Currency, error)
}

type UserRepository interface {
	GetOrCreateByTelegramID(ctx context.Context, telegramID int64, username, firstName string) (*User, error)
	GetByID(ctx context.Context, id string) (*User, error)
}

type DepositAddressRepository interface {
	AssignAddress(ctx context.Context, networkID string, userID *string) (*DepositAddress, error)
}

type InvoiceRepository interface {
	Create(ctx context.Context, inv *Invoice) error
	GetByID(ctx context.Context, id string) (*Invoice, error)
	GetByNumber(ctx context.Context, number string) (*Invoice, error)
	UpdateStatus(ctx context.Context, id string, status InvoiceStatus, paidAt *time.Time) error
	ListPending(ctx context.Context) ([]*Invoice, error)
}

type ObservedTransactionRepository interface {
	RecordTransaction(ctx context.Context, tx *ObservedTransaction) error
	Exists(ctx context.Context, networkID, txHash string) (bool, error)
}
