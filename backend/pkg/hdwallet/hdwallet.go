package hdwallet

import (
	"fmt"
	"sync"

	hdwallet "github.com/miguelmota/go-ethereum-hdwallet"
)

// Manager handles deterministic HD Wallet address and key derivation (BIP-44)
type Manager struct {
	mu       sync.RWMutex
	mnemonic string
	wallet   *hdwallet.Wallet
}

// NewManager creates an HD wallet manager from a BIP-39 mnemonic.
// If mnemonic is empty, a standard 12-word mnemonic is generated.
func NewManager(mnemonic string) (*Manager, error) {
	if mnemonic == "" {
		var err error
		mnemonic, err = hdwallet.NewMnemonic(128)
		if err != nil {
			return nil, fmt.Errorf("failed to generate mnemonic: %w", err)
		}
	}

	wallet, err := hdwallet.NewFromMnemonic(mnemonic)
	if err != nil {
		return nil, fmt.Errorf("failed to create HD wallet from mnemonic: %w", err)
	}

	return &Manager{
		mnemonic: mnemonic,
		wallet:   wallet,
	}, nil
}

// DeriveAddress derives a unique BSC / EVM address at a given index.
// Standard BIP-44 path: m/44'/60'/0'/0/{index}
func (m *Manager) DeriveAddress(index int) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	pathStr := fmt.Sprintf("m/44'/60'/0'/0/%d", index)
	path, err := hdwallet.ParseDerivationPath(pathStr)
	if err != nil {
		return "", fmt.Errorf("invalid derivation path: %w", err)
	}

	account, err := m.wallet.Derive(path, false)
	if err != nil {
		return "", fmt.Errorf("failed to derive account: %w", err)
	}

	return account.Address.Hex(), nil
}

// DerivePrivateKey derives the child private key (in hex format) for rebalancing/sweeping funds.
// This is done on-demand in memory; private keys are NEVER stored in plaintext in the database.
func (m *Manager) DerivePrivateKey(index int) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	pathStr := fmt.Sprintf("m/44'/60'/0'/0/%d", index)
	path, err := hdwallet.ParseDerivationPath(pathStr)
	if err != nil {
		return "", fmt.Errorf("invalid derivation path: %w", err)
	}

	account, err := m.wallet.Derive(path, false)
	if err != nil {
		return "", fmt.Errorf("failed to derive account: %w", err)
	}

	return m.wallet.PrivateKeyHex(account)
}

// GetMnemonic returns the master mnemonic seed phrase
func (m *Manager) GetMnemonic() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.mnemonic
}
