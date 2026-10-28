package hdwallet

import (
	"fmt"
	"strings"
	"sync"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/ethereum/go-ethereum/crypto"
	hdwallet "github.com/miguelmota/go-ethereum-hdwallet"
)

// Manager handles deterministic HD Wallet address and key derivation (BIP-44)
type Manager struct {
	mu       sync.RWMutex
	mnemonic string
	wallet   *hdwallet.Wallet
	xpubKey  *hdkeychain.ExtendedKey
	xpubStr  string
}

// NewManagerFromConfig creates a manager using either an XPUB (recommended, zero-privkey on server)
// or a BIP-39 mnemonic fallback.
func NewManagerFromConfig(xpub, mnemonic string) (*Manager, error) {
	m := &Manager{}

	xpub = strings.TrimSpace(xpub)
	mnemonic = strings.TrimSpace(mnemonic)

	if xpub != "" {
		xKey, err := hdkeychain.NewKeyFromString(xpub)
		if err != nil {
			return nil, fmt.Errorf("invalid BSC_XPUB: %w", err)
		}
		m.xpubKey = xKey
		m.xpubStr = xpub
	}

	if mnemonic != "" {
		wallet, err := hdwallet.NewFromMnemonic(mnemonic)
		if err != nil {
			return nil, fmt.Errorf("failed to create wallet from mnemonic: %w", err)
		}
		m.wallet = wallet
		m.mnemonic = mnemonic
	}

	if m.xpubKey == nil && m.wallet == nil {
		return nil, fmt.Errorf("either BSC_XPUB or BSC_MASTER_MNEMONIC must be configured")
	}

	return m, nil
}

// NewManager creates an HD wallet manager from a BIP-39 mnemonic (for backward compatibility).
func NewManager(mnemonic string) (*Manager, error) {
	mnemonic = strings.TrimSpace(mnemonic)
	if mnemonic == "" {
		var err error
		mnemonic, err = hdwallet.NewMnemonic(128)
		if err != nil {
			return nil, fmt.Errorf("failed to generate mnemonic: %w", err)
		}
	}
	return NewManagerFromConfig("", mnemonic)
}

// DeriveAddress derives a unique BSC / EVM address at a given index.
// If xpub is configured (recommended), it derives directly from xpub without touching private keys!
// Standard BIP-44 path: m/44'/60'/0'/0/{index}
func (m *Manager) DeriveAddress(index int) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// 1. Preferred: derive from XPUB (zero-risk public key derivation)
	if m.xpubKey != nil {
		childKey, err := m.xpubKey.Derive(uint32(index))
		if err != nil {
			return "", fmt.Errorf("failed to derive child from xpub at index %d: %w", index, err)
		}
		ecPub, err := childKey.ECPubKey()
		if err != nil {
			return "", fmt.Errorf("failed to extract EC public key: %w", err)
		}
		addr := crypto.PubkeyToAddress(*ecPub.ToECDSA())
		return addr.Hex(), nil
	}

	// 2. Fallback: derive from mnemonic wallet
	if m.wallet != nil {
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

	return "", fmt.Errorf("no valid xpub or mnemonic configured to derive address")
}

// DerivePrivateKey derives the child private key (in hex format) for rebalancing/sweeping funds.
func (m *Manager) DerivePrivateKey(index int) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.wallet == nil {
		return "", fmt.Errorf("کلید خصوصی یا ۱۲ کلمه روی سرور وجود ندارد. جهت ریبالانسینگ باید ۱۲ کلمه توسط اپراتور وارد شود.")
	}

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

// DerivePrivateKeyWithMnemonic derives child private key on-demand in volatile RAM using an operator-provided mnemonic.
// The mnemonic is NEVER persisted to disk or database.
func (m *Manager) DerivePrivateKeyWithMnemonic(mnemonic string, index int) (string, error) {
	mnemonic = strings.TrimSpace(mnemonic)
	if mnemonic == "" {
		return m.DerivePrivateKey(index)
	}

	tempWallet, err := hdwallet.NewFromMnemonic(mnemonic)
	if err != nil {
		return "", fmt.Errorf("عبارت ۱۲ کلمه‌ای وارد شده نامعتبر است: %w", err)
	}

	pathStr := fmt.Sprintf("m/44'/60'/0'/0/%d", index)
	path, err := hdwallet.ParseDerivationPath(pathStr)
	if err != nil {
		return "", fmt.Errorf("invalid derivation path: %w", err)
	}

	account, err := tempWallet.Derive(path, false)
	if err != nil {
		return "", fmt.Errorf("failed to derive account: %w", err)
	}

	return tempWallet.PrivateKeyHex(account)
}

// HasPrivateKeyCapability returns true if server has master mnemonic locally
func (m *Manager) HasPrivateKeyCapability() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.wallet != nil
}

// GetMnemonic returns the master mnemonic seed phrase (or empty if xpub-only)
func (m *Manager) GetMnemonic() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.mnemonic
}

// GetXPUB returns the configured XPUB string
func (m *Manager) GetXPUB() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.xpubStr
}
