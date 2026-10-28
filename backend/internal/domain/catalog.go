package domain

// Network represents a supported blockchain (e.g. bsc, eth, ton)
type Network struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	NativeCurrency string `json:"native_currency"`
	RPCEndpoint    string `json:"rpc_endpoint,omitempty"`
	IsTestnet      bool   `json:"is_testnet"`
	IsActive       bool   `json:"is_active"`
}

// Currency represents a coin or token on a specific network
type Currency struct {
	ID              string  `json:"id"`
	Symbol          string  `json:"symbol"` // e.g. 'USDT', 'BNB', 'ETH', 'GRAM'
	NetworkID       string  `json:"network_id"`
	ContractAddress *string `json:"contract_address,omitempty"`
	Decimals        int     `json:"decimals"`
	MinDeposit      float64 `json:"min_deposit"`
	IsActive        bool    `json:"is_active"`
}
