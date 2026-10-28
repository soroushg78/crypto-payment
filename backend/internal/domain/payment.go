package domain

import (
	"time"
)

type InvoiceStatus string

const (
	StatusPending   InvoiceStatus = "PENDING"
	StatusPaid      InvoiceStatus = "PAID"
	StatusExpired   InvoiceStatus = "EXPIRED"
	StatusFailed    InvoiceStatus = "FAILED"
	StatusUnderpaid InvoiceStatus = "UNDERPAID"
)

// DepositAddress represents a unique or memo-assigned wallet address
type DepositAddress struct {
	ID              string    `json:"id"`
	UserID          *string   `json:"user_id,omitempty"`
	NetworkID       string    `json:"network_id"`
	Address         string    `json:"address"`
	Memo            *string   `json:"memo,omitempty"`
	DerivationIndex *int      `json:"derivation_index,omitempty"`
	IsAssigned      bool      `json:"is_assigned"`
	CreatedAt       time.Time `json:"created_at"`
}

// Invoice represents an order created by a user for a payment in cryptocurrency
type Invoice struct {
	ID            string        `json:"id"`
	InvoiceNumber string        `json:"invoice_number"`
	UserID        *string       `json:"user_id,omitempty"`
	CurrencyID    string        `json:"currency_id"`
	NetworkID     string        `json:"network_id"`
	AmountUSD     float64       `json:"amount_usd"`
	CryptoAmount  float64       `json:"crypto_amount"`
	ExchangeRate  float64       `json:"exchange_rate"`
	PayAddress    string        `json:"pay_address"`
	PayMemo       *string       `json:"pay_memo,omitempty"`
	Status        InvoiceStatus `json:"status"`
	ExpiresAt     time.Time     `json:"expires_at"`
	PaidAt        *time.Time    `json:"paid_at,omitempty"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`

	// Joined details for API convenience
	CurrencySymbol   string `json:"currency_symbol,omitempty"`
	NetworkName      string `json:"network_name,omitempty"`
	TelegramUsername string `json:"telegram_username,omitempty"`
	TelegramID       *int64 `json:"telegram_id,omitempty"`
}

func (i *Invoice) IsExpired() bool {
	return time.Now().After(i.ExpiresAt) && i.Status == StatusPending
}

// ObservedTransaction represents an on-chain transaction detected by the Observer
type ObservedTransaction struct {
	ID            string     `json:"id"`
	InvoiceID     *string    `json:"invoice_id,omitempty"`
	NetworkID     string     `json:"network_id"`
	TxHash        string     `json:"tx_hash"`
	FromAddress   string     `json:"from_address,omitempty"`
	ToAddress     string     `json:"to_address"`
	Amount        float64    `json:"amount"`
	Memo          *string    `json:"memo,omitempty"`
	BlockNumber   int64      `json:"block_number,omitempty"`
	Confirmations int        `json:"confirmations"`
	Status        string     `json:"status"` // DETECTED, CONFIRMED, REJECTED
	DetectedAt    time.Time  `json:"detected_at"`
	ConfirmedAt   *time.Time `json:"confirmed_at,omitempty"`
}

// CreateInvoiceInput represents input DTO for creating a new invoice
type CreateInvoiceInput struct {
	AmountUSD    float64 `json:"amount_usd"`
	CurrencyID   string  `json:"currency_id,omitempty"`
	NetworkID    string  `json:"network_id,omitempty"`
	Network      string  `json:"network,omitempty"`
	Currency     string  `json:"currency,omitempty"`
	TelegramID   *int64  `json:"telegram_id,omitempty"`
	Username     string  `json:"username,omitempty"`
	CustomAmount float64 `json:"custom_amount,omitempty"`
}
