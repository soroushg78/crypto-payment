package domain

import "time"

// RebalanceWalletStatus represents an assigned BSC deposit wallet and its on-chain status
type RebalanceWalletStatus struct {
	ID                string    `json:"id"`
	DerivationIndex   int       `json:"derivation_index"`
	DerivationPath    string    `json:"derivation_path"`
	Address           string    `json:"address"`
	NetworkID         string    `json:"network_id"`
	BNBBalance        float64   `json:"bnb_balance"`
	USDTBalance       float64   `json:"usdt_balance"`
	NeedsRefuel       bool      `json:"needs_refuel"`
	SweepStatus       string    `json:"sweep_status"` // "READY_USDT", "READY_BNB", "NEED_GAS", "SWEPT", "EMPTY"
	AssociatedInvoice *string   `json:"associated_invoice,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
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
	DerivationIndex int     `json:"derivation_index"`
	Asset           string  `json:"asset"` // "USDT" or "BNB"
	TreasuryAddress string  `json:"treasury_address,omitempty"`
	RealBroadcast   bool    `json:"real_broadcast"` // If true, broadcasts to BSC RPC; if false, performs secure dry-run simulation
}

// SweepResult contains the outcome of the sweep execution
type SweepResult struct {
	DerivationIndex int            `json:"derivation_index"`
	DepositAddress  string         `json:"deposit_address"`
	TreasuryAddress string         `json:"treasury_address"`
	AssetSwept      string         `json:"asset_swept"`
	AmountSwept     float64        `json:"amount_swept"`
	GasFeeBNB       float64        `json:"gas_fee_bnb"`
	RefuelRequired  bool           `json:"refuel_required"`
	RefuelTxHash    string         `json:"refuel_tx_hash,omitempty"`
	SweepTxHash     string         `json:"sweep_tx_hash,omitempty"`
	IsBroadcasted   bool           `json:"is_broadcasted"`
	Logs            []SweepStepLog `json:"logs"`
	ExecutedAt      time.Time      `json:"executed_at"`
}

// GasEstimateResult contains dynamic on-chain gas calculation from BSC node
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

// BatchSweepRequest payload to trigger multiple wallets sweeping
type BatchSweepRequest struct {
	DerivationIndexes []int  `json:"derivation_indexes,omitempty"` // If empty, sweeps all wallets with balance
	Asset             string `json:"asset,omitempty"`              // "ALL", "BNB", "USDT"
	TreasuryAddress   string `json:"treasury_address,omitempty"`
	RealBroadcast     bool   `json:"real_broadcast"`
}
