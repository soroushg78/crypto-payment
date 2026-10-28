package domain

import "time"

// VaultSplit represents a target destination vault and its allocation percentage (e.g. 70%, 20%, 10%)
type VaultSplit struct {
	Address    string  `json:"address"`
	Percentage float64 `json:"percentage"`      // e.g. 70.0, 20.0, 10.0
	Label      string  `json:"label,omitempty"` // "خزانه سرد (Cold)", "خزانه گرم (Hot)", "مخزن گس (Gas)"
}

// SplitTransferResult records the outcome of an individual split transfer
type SplitTransferResult struct {
	VaultAddress string  `json:"vault_address"`
	Label        string  `json:"label"`
	Percentage   float64 `json:"percentage"`
	Amount       float64 `json:"amount"`
	TxHash       string  `json:"tx_hash,omitempty"`
}

// RebalanceWalletStatus represents an assigned deposit wallet and its on-chain status
type RebalanceWalletStatus struct {
	ID                string     `json:"id"`
	DerivationIndex   int        `json:"derivation_index"`
	DerivationPath    string     `json:"derivation_path"`
	Address           string     `json:"address"`
	NetworkID         string     `json:"network_id"`
	NativeBalance     float64    `json:"native_balance"` // BNB or ETH
	BNBBalance        float64    `json:"bnb_balance"`    // for backward compatibility
	USDTBalance       float64    `json:"usdt_balance"`
	NeedsRefuel       bool       `json:"needs_refuel"`
	SweepStatus       string     `json:"sweep_status"` // "READY_USDT", "READY_NATIVE", "NEED_GAS", "SWEPT", "EMPTY"
	AssociatedInvoice *string    `json:"associated_invoice,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	InvoiceCreatedAt  *time.Time `json:"invoice_created_at,omitempty"`
	PaidAt            *time.Time `json:"paid_at,omitempty"`
}

// SweepStepLog represents a discrete execution step during sweeping
type SweepStepLog struct {
	Step        int    `json:"step"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Status      string `json:"status"` // "SUCCESS", "PENDING", "SIMULATED", "FAILED"
	TxHash      string `json:"tx_hash,omitempty"`
	Details     string `json:"details,omitempty"`
}

// SweepRequest payload to trigger sweeping
type SweepRequest struct {
	NetworkID       string       `json:"network_id,omitempty"` // "bsc" or "eth" (defaults to "bsc")
	DerivationIndex int          `json:"derivation_index"`
	Asset           string       `json:"asset"` // "USDT", "BNB", "ETH"
	TreasuryAddress string       `json:"treasury_address,omitempty"`
	VaultSplits     []VaultSplit `json:"vault_splits,omitempty"` // Multi-Vault destinations (e.g. 70%, 20%, 10%)
	RealBroadcast   bool         `json:"real_broadcast"`        // If true, broadcasts to EVM RPC
	Mnemonic        string       `json:"mnemonic,omitempty"`    // Optional operator mnemonic for non-custodial sweeping in RAM
}

// SweepResult contains the outcome of the sweep execution
type SweepResult struct {
	NetworkID       string                `json:"network_id,omitempty"`
	DerivationIndex int                   `json:"derivation_index"`
	DepositAddress  string                `json:"deposit_address"`
	TreasuryAddress string                `json:"treasury_address"`
	AssetSwept      string                `json:"asset_swept"`
	AmountSwept     float64               `json:"amount_swept"`
	GasFeeBNB       float64               `json:"gas_fee_bnb"`
	RefuelRequired  bool                  `json:"refuel_required"`
	RefuelTxHash    string                `json:"refuel_tx_hash,omitempty"`
	SweepTxHash     string                `json:"sweep_tx_hash,omitempty"`
	IsBroadcasted   bool                  `json:"is_broadcasted"`
	Splits          []SplitTransferResult `json:"splits,omitempty"` // Many-to-Many split transfers
	Logs            []SweepStepLog        `json:"logs"`
	ExecutedAt      time.Time             `json:"executed_at"`
}

// GasEstimateResult contains dynamic on-chain gas calculation from BSC/ETH node
type GasEstimateResult struct {
	Asset          string    `json:"asset"`
	DepositAddress string    `json:"deposit_address"`
	GasUnits       uint64    `json:"gas_units"`
	GasPriceGwei   float64   `json:"gas_price_gwei"`
	TotalFeeBNB    float64   `json:"total_fee_bnb"`
	CurrentBNB     float64   `json:"current_bnb"`
	CurrentUSDT    float64   `json:"current_usdt"`
	DeficitBNB     float64   `json:"deficit_bnb"`
	NeedsRefuel    bool      `json:"needs_refuel"`
	EstimatedAt    time.Time `json:"estimated_at"`
}

// BatchSweepRequest payload to trigger multiple wallets sweeping (Many-to-Many)
type BatchSweepRequest struct {
	NetworkID         string       `json:"network_id,omitempty"` // "bsc" or "eth"
	DerivationIndexes []int        `json:"derivation_indexes,omitempty"`
	Asset             string       `json:"asset,omitempty"` // "ALL", "BNB", "ETH", "USDT"
	TreasuryAddress   string       `json:"treasury_address,omitempty"`
	VaultSplits       []VaultSplit `json:"vault_splits,omitempty"` // Many-to-Many Multi-Vault Destinations
	RealBroadcast     bool         `json:"real_broadcast"`
	Mnemonic          string       `json:"mnemonic,omitempty"` // Optional operator mnemonic for non-custodial sweeping in RAM
}

// TONTreasuryItem represents an invoice / memo routed to the TON treasury
type TONTreasuryItem struct {
	ID            string     `json:"id"`
	InvoiceNumber string     `json:"invoice_number"`
	Memo          string     `json:"memo"`
	AmountUSD     float64    `json:"amount_usd"`
	CryptoAmount  float64    `json:"crypto_amount"`
	Currency      string     `json:"currency"`
	Status        string     `json:"status"` // PAID, PENDING, EXPIRED
	PayAddress    string     `json:"pay_address"`
	TxHash        string     `json:"tx_hash,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	PaidAt        *time.Time `json:"paid_at,omitempty"`
}

// TONTreasuryStatus represents the TON network master treasury wallet and memo rebalancing state
type TONTreasuryStatus struct {
	TreasuryAddress   string             `json:"treasury_address"`
	BalanceTON        float64            `json:"balance_ton"` // live on-chain balance from Toncenter
	Architecture      string             `json:"architecture"`
	GasModel          string             `json:"gas_model"`
	TotalInvoices     int                `json:"total_invoices"`
	PaidInvoices      int                `json:"paid_invoices"`
	PendingInvoices   int                `json:"pending_invoices"`
	TotalCollectedTON float64            `json:"total_collected_ton"`
	Items             []*TONTreasuryItem `json:"items"`
}

// RebalanceRecord represents an immutable audit log of a rebalance / sweep operation
type RebalanceRecord struct {
	ID              string    `json:"id"`
	NetworkID       string    `json:"network_id"`
	DerivationIndex *int      `json:"derivation_index,omitempty"`
	FromAddress     string    `json:"from_address"`
	ToAddress       string    `json:"to_address"`
	Asset           string    `json:"asset"`
	Amount          float64   `json:"amount"`
	GasFeeBNB       float64   `json:"gas_fee_bnb"`
	TxHash          *string   `json:"tx_hash,omitempty"`
	Status          string    `json:"status"` // "COMPLETED", "FAILED", "PENDING"
	IsSimulated     bool      `json:"is_simulated"`
	ErrorMessage    *string   `json:"error_message,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}
