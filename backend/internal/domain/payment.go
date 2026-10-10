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

// User represents a customer (from Web or Telegram Bot)
type User struct {
	ID         string    `json:"id"`
	TelegramID *int64    `json:"telegram_id,omitempty"`
	Username   string    `json:"username,omitempty"`
	FirstName  string    `json:"first_name,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

// Service represents a product, subscription, or item for purchase
type Service struct {
	ID          string    `json:"id"`
	Code        string    `json:"code"`
	Title       string    `json:"title"`
	Description string    `json:"description,omitempty"`
	PriceUSD    float64   `json:"price_usd"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
}

// Network represents a supported blockchain
type Network struct {
	ID             string `json:"id"` // e.g. 'ton', 'tron'
	Name           string `json:"name"`
	NativeCurrency string `json:"native_currency"`
	RPCEndpoint    string `json:"rpc_endpoint,omitempty"`
	IsTestnet      bool   `json:"is_testnet"`
	IsActive       bool   `json:"is_active"`
}

// Currency represents a coin or token on a specific network
type Currency struct {
	ID              string  `json:"id"`
	Symbol          string  `json:"symbol"` // e.g. 'USDT', 'TON'
	NetworkID       string  `json:"network_id"`
	ContractAddress *string `json:"contract_address,omitempty"`
	Decimals        int     `json:"decimals"`
	MinDeposit      float64 `json:"min_deposit"`
	IsActive        bool    `json:"is_active"`
}

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

// Invoice represents an order created by a user for a specific service and currency
type Invoice struct {
	ID            string        `json:"id"`
	InvoiceNumber string        `json:"invoice_number"`
	UserID        *string       `json:"user_id,omitempty"`
	ServiceID     string        `json:"service_id"`
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
	ServiceTitle   string `json:"service_title,omitempty"`
	CurrencySymbol string `json:"currency_symbol,omitempty"`
	NetworkName    string `json:"network_name,omitempty"`
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

// DTOs for requests
type CreateInvoiceInput struct {
	ServiceID    string  `json:"service_id"`
	CurrencyID   string  `json:"currency_id"`
	NetworkID    string  `json:"network_id"`
	TelegramID   *int64  `json:"telegram_id,omitempty"`
	Username     string  `json:"username,omitempty"`
	CustomAmount float64 `json:"custom_amount,omitempty"` // For wallet top-up services
}
