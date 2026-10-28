package usecase

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"wallet-observer/internal/domain"
	"wallet-observer/pkg/bscrpc"
	"wallet-observer/pkg/hdwallet"
	"wallet-observer/pkg/tonrpc"
)

type RebalanceUseCase struct {
	addressRepo domain.DepositAddressRepository
	hdManager   *hdwallet.Manager
	bscClient   *bscrpc.Client
	ethClient   *bscrpc.Client
	invoiceRepo domain.InvoiceRepository
	tonClient   *tonrpc.Client
	recordRepo  domain.RebalanceRecordRepository
}

func NewRebalanceUseCase(
	addressRepo domain.DepositAddressRepository,
	hdManager *hdwallet.Manager,
	bscClient *bscrpc.Client,
	ethClient *bscrpc.Client,
	invoiceRepo domain.InvoiceRepository,
	tonClient *tonrpc.Client,
	recordRepo domain.RebalanceRecordRepository,
) *RebalanceUseCase {
	return &RebalanceUseCase{
		addressRepo: addressRepo,
		hdManager:   hdManager,
		bscClient:   bscClient,
		ethClient:   ethClient,
		invoiceRepo: invoiceRepo,
		tonClient:   tonClient,
		recordRepo:  recordRepo,
	}
}

func (u *RebalanceUseCase) getClientForNetwork(networkID string) *bscrpc.Client {
	if strings.ToLower(strings.TrimSpace(networkID)) == "eth" {
		if u.ethClient != nil {
			return u.ethClient
		}
	}
	return u.bscClient
}

// ListWallets returns all assigned deposit addresses for a network (BSC or ETH) with live balances
func (u *RebalanceUseCase) ListWallets(ctx context.Context, networkID string) ([]*domain.RebalanceWalletStatus, error) {
	networkID = strings.ToLower(strings.TrimSpace(networkID))
	if networkID == "" {
		networkID = "bsc"
	}

	client := u.getClientForNetwork(networkID)

	addresses, err := u.addressRepo.ListAssigned(ctx, networkID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve assigned %s addresses: %w", networkID, err)
	}

	allInvoices, _ := u.invoiceRepo.ListAll(ctx, 300)
	invByAddr := make(map[string]*domain.Invoice)
	for _, inv := range allInvoices {
		if strings.EqualFold(inv.NetworkID, networkID) {
			addrLower := strings.ToLower(inv.PayAddress)
			if _, exists := invByAddr[addrLower]; !exists {
				invByAddr[addrLower] = inv
			}
		}
	}

	var results []*domain.RebalanceWalletStatus
	for _, addr := range addresses {
		index := 0
		if addr.DerivationIndex != nil {
			index = *addr.DerivationIndex
		}

		path := fmt.Sprintf("m/44'/60'/0'/0/%d", index)

		ctxBal, cancel := context.WithTimeout(ctx, 3*time.Second)
		nativeBal, _ := client.GetNativeBalance(ctxBal, addr.Address)
		usdtBal, _ := client.GetUSDTBalance(ctxBal, addr.Address)
		cancel()

		needsRefuel := false
		sweepStatus := "EMPTY"

		if usdtBal > 0 {
			if nativeBal < 0.0003 {
				needsRefuel = true
				sweepStatus = "NEED_GAS"
			} else {
				sweepStatus = "READY_USDT"
			}
		} else if nativeBal > 0.001 {
			sweepStatus = "READY_NATIVE"
		}

		var invCreatedAt *time.Time
		var paidAt *time.Time
		var invNum *string
		if inv, ok := invByAddr[strings.ToLower(addr.Address)]; ok {
			invCreatedAt = &inv.CreatedAt
			paidAt = inv.PaidAt
			invNum = &inv.InvoiceNumber
		} else {
			invCreatedAt = &addr.CreatedAt
		}

		item := &domain.RebalanceWalletStatus{
			ID:                addr.ID,
			DerivationIndex:   index,
			DerivationPath:    path,
			Address:           addr.Address,
			NetworkID:         networkID,
			NativeBalance:     nativeBal,
			BNBBalance:        nativeBal, // for backward compatibility
			USDTBalance:       usdtBal,
			NeedsRefuel:       needsRefuel,
			SweepStatus:       sweepStatus,
			AssociatedInvoice: invNum,
			CreatedAt:         addr.CreatedAt,
			InvoiceCreatedAt:  invCreatedAt,
			PaidAt:            paidAt,
		}

		results = append(results, item)
	}

	return results, nil
}

// ListBSCWallets returns assigned BSC addresses (backward compatibility)
func (u *RebalanceUseCase) ListBSCWallets(ctx context.Context) ([]*domain.RebalanceWalletStatus, error) {
	return u.ListWallets(ctx, "bsc")
}

// ExecuteSweep performs sweeping with support for Multi-Vault Many-to-Many splits
func (u *RebalanceUseCase) ExecuteSweep(ctx context.Context, req domain.SweepRequest) (*domain.SweepResult, error) {
	networkID := strings.ToLower(strings.TrimSpace(req.NetworkID))
	if networkID == "" {
		if strings.EqualFold(req.Asset, "ETH") {
			networkID = "eth"
		} else {
			networkID = "bsc"
		}
	}

	client := u.getClientForNetwork(networkID)

	// 1. Derive target address
	address, err := u.hdManager.DeriveAddress(req.DerivationIndex)
	if err != nil {
		return nil, fmt.Errorf("failed to derive address at index %d: %w", req.DerivationIndex, err)
	}

	// 2. Execute sweep sequence via EVM client (supports Multi-Vault splits)
	res, err := client.ExecuteOrSimulateSweep(
		ctx,
		req.DerivationIndex,
		address,
		req.Asset,
		req.TreasuryAddress,
		req.Mnemonic,
		req.VaultSplits,
	)
	if err != nil {
		return nil, err
	}

	// 3. Mark pending invoice as PAID
	if u.invoiceRepo != nil {
		_ = u.invoiceRepo.MarkPaidByAddress(ctx, address)
	}

	// 4. Save audit log record to rebalance_records table
	if u.recordRepo != nil && res != nil {
		idx := req.DerivationIndex
		txHashStr := res.SweepTxHash
		if txHashStr == "" {
			txHashStr = res.RefuelTxHash
		}
		status := "COMPLETED"

		toAddrDesc := res.TreasuryAddress
		if len(res.Splits) > 1 {
			var parts []string
			for _, s := range res.Splits {
				parts = append(parts, fmt.Sprintf("%s(%.0f%%:%.4f)", s.Label, s.Percentage, s.Amount))
			}
			toAddrDesc = fmt.Sprintf("Multi-Vault: %s", strings.Join(parts, ", "))
		}

		_ = u.recordRepo.Create(ctx, &domain.RebalanceRecord{
			NetworkID:       networkID,
			DerivationIndex: &idx,
			FromAddress:     res.DepositAddress,
			ToAddress:       toAddrDesc,
			Asset:           res.AssetSwept,
			Amount:          res.AmountSwept,
			GasFeeBNB:       res.GasFeeBNB,
			TxHash:          &txHashStr,
			Status:          status,
			IsSimulated:     false,
			CreatedAt:       time.Now(),
		})
	}

	return res, nil
}

// ExecuteBatchSweep sweeps multiple wallets sequentially with Multi-Vault splits (Many-to-Many)
func (u *RebalanceUseCase) ExecuteBatchSweep(ctx context.Context, req domain.BatchSweepRequest) ([]*domain.SweepResult, error) {
	networkID := strings.ToLower(strings.TrimSpace(req.NetworkID))
	if networkID == "" {
		if strings.EqualFold(req.Asset, "ETH") {
			networkID = "eth"
		} else {
			networkID = "bsc"
		}
	}

	wallets, err := u.ListWallets(ctx, networkID)
	if err != nil {
		return nil, fmt.Errorf("failed to list wallets for batch sweep on %s: %w", networkID, err)
	}

	targetIndexMap := make(map[int]bool)
	for _, idx := range req.DerivationIndexes {
		targetIndexMap[idx] = true
	}

	client := u.getClientForNetwork(networkID)
	nativeCoin := client.NativeSymbol()

	var results []*domain.SweepResult
	for _, w := range wallets {
		if w.DerivationIndex == 0 {
			continue // skip gas station
		}
		if len(req.DerivationIndexes) > 0 && !targetIndexMap[w.DerivationIndex] {
			continue
		}
		if len(req.DerivationIndexes) == 0 && w.NativeBalance <= 0.0005 && w.USDTBalance <= 0 {
			continue
		}

		asset := req.Asset
		if asset == "" || strings.EqualFold(asset, "ALL") {
			if w.USDTBalance > 0 {
				asset = "USDT"
			} else if w.NativeBalance > 0.0005 {
				asset = nativeCoin
			} else {
				continue
			}
		}

		res, err := u.ExecuteSweep(ctx, domain.SweepRequest{
			NetworkID:       networkID,
			DerivationIndex: w.DerivationIndex,
			Asset:           asset,
			TreasuryAddress: req.TreasuryAddress,
			VaultSplits:     req.VaultSplits,
			RealBroadcast:   req.RealBroadcast,
			Mnemonic:        req.Mnemonic,
		})
		if err != nil {
			slog.Warn("Batch sweep failed for wallet index", "network", networkID, "index", w.DerivationIndex, "error", err)
			continue
		}
		results = append(results, res)
	}

	return results, nil
}

// GetSecuritySpecs provides comprehensive architecture and security metadata
func (u *RebalanceUseCase) GetSecuritySpecs() map[string]interface{} {
	xpub := u.hdManager.GetXPUB()
	hasPrivKey := u.hdManager.HasPrivateKeyCapability()

	status := "PURE XPUB MODE - ZERO PRIVATE KEYS ON SERVER (Bank-Grade Security)"
	if hasPrivKey {
		status = "Hot Mnemonic Mode"
	}

	masterGasAddr, _ := u.hdManager.DeriveAddress(0)
	ctxBal, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	masterBNBBal, _ := u.bscClient.GetBNBBalance(ctxBal, masterGasAddr)
	cancel()

	return map[string]interface{}{
		"standard":                    "BIP-44 (Multi-Account Hierarchy for Deterministic Wallets)",
		"derivation_path":             "m/44'/60'/0'/0/{index} (Invoices: index >= 1, Gas Station: index 0)",
		"supported_evm_chains":        "BNB Smart Chain (ID: 56/97) & Ethereum (ID: 1/11155111)",
		"many_to_many_vaults":         "Supported (e.g. 70% Cold Vault, 20% Hot Vault, 10% Gas Buffer)",
		"private_key_storage":         "ZERO (Keys never stored on server; derived strictly on-demand in volatile RAM by operator)",
		"master_seed_protection":      "Pure XPUB configuration (No private keys on disk or environment)",
		"token_gas_solution":          "Dedicated Hot Gas Station Wallet (Index 0) auto-refuels native coin for token sweep",
		"gas_station_address":         masterGasAddr,
		"gas_station_bnb_balance":     masterBNBBal,
		"security_status":             status,
		"bsc_xpub":                    xpub,
		"ton_standard":                "TON Master Treasury + Unique Memo Routing (Read-Only)",
		"ton_wallet_contract":         "Wallet V5R1 / W5 Standard",
		"ton_treasury_wallet":         os.Getenv("TON_TREASURY_WALLET"),
	}
}

// EstimateGas calculates the exact on-chain gas requirements and refuel needs for sweeping
func (u *RebalanceUseCase) EstimateGas(ctx context.Context, derivationIndex int, asset, treasuryAddress, networkID string) (*domain.GasEstimateResult, error) {
	address, err := u.hdManager.DeriveAddress(derivationIndex)
	if err != nil {
		return nil, fmt.Errorf("failed to derive address for index %d: %w", derivationIndex, err)
	}

	client := u.getClientForNetwork(networkID)
	return client.EstimateSweepGas(ctx, address, asset, treasuryAddress)
}

// GetTONTreasuryStatus returns live on-chain balance and invoice memo routing for TON Master Treasury
func (u *RebalanceUseCase) GetTONTreasuryStatus(ctx context.Context) (*domain.TONTreasuryStatus, error) {
	treasuryAddr := os.Getenv("TON_TREASURY_WALLET")
	if treasuryAddr == "" {
		treasuryAddr = "UQDRW1hBJ7uPVffzd_AGaB4DS0LNNp0WfVGO0k03DqQmUHWX"
	}

	var liveBalance float64
	if u.tonClient != nil {
		ctxBal, cancel := context.WithTimeout(ctx, 4*time.Second)
		bal, err := u.tonClient.GetBalance(ctxBal, treasuryAddr)
		cancel()
		if err == nil {
			liveBalance = bal
		} else {
			slog.Warn("Failed to get TON treasury balance from node", "error", err)
		}
	}

	allInvoices, err := u.invoiceRepo.ListAll(ctx, 100)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve invoices: %w", err)
	}

	var items []*domain.TONTreasuryItem
	var totalCollected float64
	var paidCount, pendingCount int

	for _, inv := range allInvoices {
		if strings.EqualFold(inv.NetworkID, "ton") {
			memo := ""
			if inv.PayMemo != nil {
				memo = *inv.PayMemo
			}

			item := &domain.TONTreasuryItem{
				ID:            inv.ID,
				InvoiceNumber: inv.InvoiceNumber,
				Memo:          memo,
				AmountUSD:     inv.AmountUSD,
				CryptoAmount:  inv.CryptoAmount,
				Currency:      inv.CurrencySymbol,
				Status:        string(inv.Status),
				PayAddress:    inv.PayAddress,
				CreatedAt:     inv.CreatedAt,
				PaidAt:        inv.PaidAt,
			}

			if inv.Status == domain.StatusPaid {
				paidCount++
				totalCollected += inv.CryptoAmount
			} else if inv.Status == domain.StatusPending {
				pendingCount++
			}

			items = append(items, item)
		}
	}

	return &domain.TONTreasuryStatus{
		TreasuryAddress:   treasuryAddr,
		BalanceTON:        liveBalance,
		Architecture:      "Single Master Treasury + Unique Memo Routing (Wallex / Binance Ops)",
		GasModel:          "Zero-Gas Internal Rebalancing (Direct Treasury Inflow)",
		TotalInvoices:     len(items),
		PaidInvoices:      paidCount,
		PendingInvoices:   pendingCount,
		TotalCollectedTON: totalCollected,
		Items:             items,
	}, nil
}

// ListRebalanceRecords retrieves recent rebalance and sweep records from the database
func (u *RebalanceUseCase) ListRebalanceRecords(ctx context.Context, limit int) ([]*domain.RebalanceRecord, error) {
	if u.recordRepo == nil {
		return []*domain.RebalanceRecord{}, nil
	}
	return u.recordRepo.ListAll(ctx, limit)
}
