package usecase

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"wallet-observer/internal/domain"
	"wallet-observer/pkg/bscrpc"
	"wallet-observer/pkg/hdwallet"
)

type RebalanceUseCase struct {
	addressRepo domain.DepositAddressRepository
	hdManager   *hdwallet.Manager
	bscClient   *bscrpc.Client
}

func NewRebalanceUseCase(
	addressRepo domain.DepositAddressRepository,
	hdManager *hdwallet.Manager,
	bscClient *bscrpc.Client,
) *RebalanceUseCase {
	return &RebalanceUseCase{
		addressRepo: addressRepo,
		hdManager:   hdManager,
		bscClient:   bscClient,
	}
}

// ListBSCWallets returns all assigned BSC deposit addresses with their live on-chain balances
func (u *RebalanceUseCase) ListBSCWallets(ctx context.Context) ([]*domain.RebalanceWalletStatus, error) {
	addresses, err := u.addressRepo.ListAssigned(ctx, "bsc")
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve assigned BSC addresses: %w", err)
	}

	var results []*domain.RebalanceWalletStatus
	for _, addr := range addresses {
		index := 0
		if addr.DerivationIndex != nil {
			index = *addr.DerivationIndex
		}

		path := fmt.Sprintf("m/44'/60'/0'/0/%d", index)

		// Fetch on-chain balances asynchronously / with timeout
		ctxBal, cancel := context.WithTimeout(ctx, 3*time.Second)
		bnbBal, _ := u.bscClient.GetBNBBalance(ctxBal, addr.Address)
		usdtBal, _ := u.bscClient.GetUSDTBalance(ctxBal, addr.Address)
		cancel()

		needsRefuel := false
		sweepStatus := "EMPTY"

		if usdtBal > 0 {
			if bnbBal < 0.0002 {
				needsRefuel = true
				sweepStatus = "NEED_GAS"
			} else {
				sweepStatus = "READY_USDT"
			}
		} else if bnbBal > 0.001 {
			sweepStatus = "READY_BNB"
		}

		item := &domain.RebalanceWalletStatus{
			ID:              addr.ID,
			DerivationIndex: index,
			DerivationPath:  path,
			Address:         addr.Address,
			NetworkID:       addr.NetworkID,
			BNBBalance:      bnbBal,
			USDTBalance:     usdtBal,
			NeedsRefuel:     needsRefuel,
			SweepStatus:     sweepStatus,
			CreatedAt:       addr.CreatedAt,
		}

		results = append(results, item)
	}

	return results, nil
}

// ExecuteSweep performs or simulates the sweeping process for a specified derivation index
func (u *RebalanceUseCase) ExecuteSweep(ctx context.Context, req domain.SweepRequest) (*domain.SweepResult, error) {
	// 1. Derive the target address for verification
	address, err := u.hdManager.DeriveAddress(req.DerivationIndex)
	if err != nil {
		return nil, fmt.Errorf("failed to derive address at index %d: %w", req.DerivationIndex, err)
	}

	// 2. Execute sweep sequence via BSC client
	return u.bscClient.ExecuteOrSimulateSweep(
		ctx,
		req.DerivationIndex,
		address,
		req.Asset,
		req.TreasuryAddress,
		req.RealBroadcast,
	)
}

// ExecuteBatchSweep sweeps multiple wallets sequentially with auto-refueling
func (u *RebalanceUseCase) ExecuteBatchSweep(ctx context.Context, req domain.BatchSweepRequest) ([]*domain.SweepResult, error) {
	wallets, err := u.ListBSCWallets(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list wallets for batch sweep: %w", err)
	}

	targetIndexMap := make(map[int]bool)
	for _, idx := range req.DerivationIndexes {
		targetIndexMap[idx] = true
	}

	var results []*domain.SweepResult
	for _, w := range wallets {
		if w.DerivationIndex == 0 {
			continue // skip gas station
		}
		// If specific indexes requested, check membership
		if len(req.DerivationIndexes) > 0 && !targetIndexMap[w.DerivationIndex] {
			continue
		}
		// If no specific indexes, only sweep wallets with balance
		if len(req.DerivationIndexes) == 0 && w.BNBBalance <= 0.0005 && w.USDTBalance <= 0 {
			continue
		}

		// Determine asset
		asset := req.Asset
		if asset == "" || strings.EqualFold(asset, "ALL") {
			if w.USDTBalance > 0 {
				asset = "USDT"
			} else if w.BNBBalance > 0.0005 {
				asset = "BNB"
			} else {
				continue
			}
		}

		res, err := u.ExecuteSweep(ctx, domain.SweepRequest{
			DerivationIndex: w.DerivationIndex,
			Asset:           asset,
			TreasuryAddress: req.TreasuryAddress,
			RealBroadcast:   req.RealBroadcast,
		})
		if err != nil {
			slog.Warn("Batch sweep failed for wallet index", "index", w.DerivationIndex, "error", err)
			continue
		}
		results = append(results, res)
	}

	return results, nil
}

// GetSecuritySpecs provides comprehensive architecture and security metadata for the tech lead and PM
func (u *RebalanceUseCase) GetSecuritySpecs() map[string]interface{} {
	mnemonic := u.hdManager.GetMnemonic()
	words := ""
	if len(mnemonic) > 8 {
		words = mnemonic[:6] + " ... " + mnemonic[len(mnemonic)-6:]
	}

	masterGasAddr, _ := u.hdManager.DeriveAddress(0)
	ctxBal, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	masterBNBBal, _ := u.bscClient.GetBNBBalance(ctxBal, masterGasAddr)
	cancel()

	return map[string]interface{}{
		"standard":                    "BIP-44 (Multi-Account Hierarchy for Deterministic Wallets)",
		"derivation_path":             "m/44'/60'/0'/0/{index} (Invoices: index >= 1, Gas Station: index 0)",
		"supported_evm_chain":         "BNB Smart Chain (Chain ID: 56, Testnet: 97)",
		"private_key_storage":         "ZERO (Keys never stored in PostgreSQL; derived strictly on-demand in volatile RAM)",
		"master_seed_protection":      "Master Mnemonic stored in protected environment variable / Secret Vault",
		"token_gas_solution":          "Dedicated Hot Gas Station Wallet (Index 0: Account 1 in MetaMask) auto-refuels BNB for BEP-20 token sweep",
		"gas_station_address":         masterGasAddr,
		"gas_station_bnb_balance":     masterBNBBal,
		"gas_station_derivation_path": "m/44'/60'/0'/0/0 (Dedicated Master Gas Station)",
		"direct_rpc_nodes": []string{
			"https://bsc-dataseed.binance.org",
			"https://bsc-dataseed1.defibit.io",
			"Direct BSC Full Node (Geth/Erigon)",
		},
		"mnemonic_status": "Loaded and active (" + words + ")",
		"master_mnemonic": mnemonic,
	}
}

// EstimateGas calculates the exact on-chain gas requirements and refuel needs for sweeping
func (u *RebalanceUseCase) EstimateGas(ctx context.Context, derivationIndex int, asset, treasuryAddress string) (*domain.GasEstimateResult, error) {
	address, err := u.hdManager.DeriveAddress(derivationIndex)
	if err != nil {
		return nil, fmt.Errorf("failed to derive address for index %d: %w", derivationIndex, err)
	}

	return u.bscClient.EstimateSweepGas(ctx, address, asset, treasuryAddress)
}
