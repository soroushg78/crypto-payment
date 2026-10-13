package usecase

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"math"
	"strings"
	"time"

	"wallet-observer/internal/domain"
	"wallet-observer/pkg/bscrpc"
	"wallet-observer/pkg/tonrpc"
	"wallet-observer/pkg/wallex"
)

type InvoiceUseCase struct {
	invoiceRepo     domain.InvoiceRepository
	currencyRepo    domain.CurrencyRepository
	networkRepo     domain.NetworkRepository
	userRepo        domain.UserRepository
	addressRepo     domain.DepositAddressRepository
	transactionRepo domain.ObservedTransactionRepository
	bscClient       *bscrpc.Client
	tonClient       *tonrpc.Client
	wallexClient    *wallex.Client
}

func NewInvoiceUseCase(
	invoiceRepo domain.InvoiceRepository,
	currencyRepo domain.CurrencyRepository,
	networkRepo domain.NetworkRepository,
	userRepo domain.UserRepository,
	addressRepo domain.DepositAddressRepository,
	transactionRepo domain.ObservedTransactionRepository,
	bscClient *bscrpc.Client,
	tonClient *tonrpc.Client,
	wallexClient *wallex.Client,
) *InvoiceUseCase {
	return &InvoiceUseCase{
		invoiceRepo:     invoiceRepo,
		currencyRepo:    currencyRepo,
		networkRepo:     networkRepo,
		userRepo:        userRepo,
		addressRepo:     addressRepo,
		transactionRepo: transactionRepo,
		bscClient:       bscClient,
		tonClient:       tonClient,
		wallexClient:    wallexClient,
	}
}

func (u *InvoiceUseCase) CreateInvoice(ctx context.Context, input domain.CreateInvoiceInput) (*domain.Invoice, error) {
	// 1. Resolve Pricing
	amountUSD := input.AmountUSD
	if amountUSD <= 0 && input.CustomAmount > 0 {
		amountUSD = input.CustomAmount
	}

	if amountUSD <= 0 {
		return nil, fmt.Errorf("amount_usd must be greater than 0")
	}

	// 2. Resolve Network
	networkID := strings.ToLower(strings.TrimSpace(input.NetworkID))
	if networkID == "" && input.Network != "" {
		networkID = strings.ToLower(strings.TrimSpace(input.Network))
	}
	if networkID == "" {
		return nil, fmt.Errorf("network is required (e.g. bsc, ton)")
	}

	net, err := u.networkRepo.GetByID(ctx, networkID)
	if err != nil {
		return nil, fmt.Errorf("network not found: %w", err)
	}

	// 3. Resolve Currency
	var curr *domain.Currency
	if input.CurrencyID != "" {
		curr, err = u.currencyRepo.GetByID(ctx, input.CurrencyID)
		if err != nil {
			return nil, fmt.Errorf("currency not found: %w", err)
		}
	} else if input.Currency != "" {
		curSymbol := strings.ToUpper(strings.TrimSpace(input.Currency))
		if curSymbol == "TON" || curSymbol == "TONCOIN" {
			curSymbol = "GRAM"
		}
		curr, err = u.currencyRepo.GetBySymbolAndNetwork(ctx, curSymbol, net.ID)
		if err != nil {
			return nil, fmt.Errorf("currency '%s' not supported on network '%s': %w", input.Currency, net.ID, err)
		}
	} else {
		return nil, fmt.Errorf("currency is required (e.g. usdt, bnb, gram)")
	}

	// 4. Resolve / Create User (MANDATORY)
	if input.TelegramID == nil && strings.TrimSpace(input.Username) == "" {
		return nil, fmt.Errorf("وارد کردن شناسه یا نام‌کاربری تلگرام الزامی است (telegram_id or username is required)")
	}

	var userID *string
	var telegramUsername string
	var telegramID *int64
	if input.TelegramID != nil {
		user, err := u.userRepo.GetOrCreateByTelegramID(ctx, *input.TelegramID, input.Username, input.Username)
		if err == nil && user != nil {
			userID = &user.ID
			telegramUsername = user.Username
			telegramID = user.TelegramID
		}
	} else if input.Username != "" {
		cleanUsername := strings.TrimPrefix(strings.TrimSpace(input.Username), "@")
		user, err := u.userRepo.GetOrCreateByUsername(ctx, cleanUsername, cleanUsername)
		if err == nil && user != nil {
			userID = &user.ID
			telegramUsername = user.Username
			telegramID = user.TelegramID
		}
	}

	// 5. Calculate Crypto Pricing (Wallex Live Market Oracle)
	exchangeRate, err := u.wallexClient.GetPriceUSD(ctx, curr.Symbol)
	if err != nil || exchangeRate <= 0 {
		exchangeRate = 1.0
	}
	cryptoAmount := amountUSD / exchangeRate
	multiplier := math.Pow(10, float64(curr.Decimals))
	cryptoAmount = math.Round(cryptoAmount*multiplier) / multiplier

	// 6. Assign Deposit Address & Memo
	depositAddr, err := u.addressRepo.AssignAddress(ctx, net.ID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to assign deposit address: %w", err)
	}

	// 7. Generate Invoice Number
	invNumBytes := make([]byte, 3)
	_, _ = rand.Read(invNumBytes)
	invoiceNumber := fmt.Sprintf("INV-%d-%s", time.Now().Year(), hex.EncodeToString(invNumBytes))

	now := time.Now()

	invoice := &domain.Invoice{
		InvoiceNumber:    invoiceNumber,
		UserID:           userID,
		CurrencyID:       curr.ID,
		NetworkID:        net.ID,
		AmountUSD:        amountUSD,
		CryptoAmount:     cryptoAmount,
		ExchangeRate:     exchangeRate,
		PayAddress:       depositAddr.Address,
		PayMemo:          depositAddr.Memo,
		Status:           domain.StatusPending,
		ExpiresAt:        now.Add(30 * time.Minute),
		CreatedAt:        now,
		UpdatedAt:        now,
		CurrencySymbol:   curr.Symbol,
		NetworkName:      net.Name,
		TelegramUsername: telegramUsername,
		TelegramID:       telegramID,
	}

	if err := u.invoiceRepo.Create(ctx, invoice); err != nil {
		return nil, fmt.Errorf("failed to save invoice: %w", err)
	}

	slog.Info("Invoice created", "number", invoice.InvoiceNumber, "usd", invoice.AmountUSD, "crypto", invoice.CryptoAmount)
	return invoice, nil
}

func (u *InvoiceUseCase) GetInvoice(ctx context.Context, id string) (*domain.Invoice, error) {
	inv, err := u.invoiceRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	u.checkOnChainSettlement(ctx, inv)
	return inv, nil
}

func (u *InvoiceUseCase) GetInvoiceByNumber(ctx context.Context, num string) (*domain.Invoice, error) {
	inv, err := u.invoiceRepo.GetByNumber(ctx, num)
	if err != nil {
		return nil, err
	}
	u.checkOnChainSettlement(ctx, inv)
	return inv, nil
}

func (u *InvoiceUseCase) ListInvoices(ctx context.Context, limit int) ([]*domain.Invoice, error) {
	invoices, err := u.invoiceRepo.ListAll(ctx, limit)
	if err != nil {
		return nil, err
	}

	// Verify pending invoices on-chain
	for _, inv := range invoices {
		if inv.Status == domain.StatusPending {
			u.checkOnChainSettlement(ctx, inv)
		}
	}
	return invoices, nil
}

func (u *InvoiceUseCase) checkOnChainSettlement(ctx context.Context, inv *domain.Invoice) {
	if inv == nil || inv.Status != domain.StatusPending {
		return
	}

	// 1. Check expiration
	if time.Now().After(inv.ExpiresAt) {
		_ = u.invoiceRepo.UpdateStatus(ctx, inv.ID, domain.StatusExpired, nil)
		inv.Status = domain.StatusExpired
		return
	}

	// 2. Real on-chain check for BSC
	if inv.NetworkID == "bsc" && u.bscClient != nil {
		checkCtx, cancel := context.WithTimeout(context.Background(), 3500*time.Millisecond)
		defer cancel()

		var liveBalance float64
		var err error

		if strings.EqualFold(inv.CurrencySymbol, "BNB") {
			liveBalance, err = u.bscClient.GetBNBBalance(checkCtx, inv.PayAddress)
		} else if strings.Contains(strings.ToUpper(inv.CurrencySymbol), "USDT") {
			liveBalance, err = u.bscClient.GetUSDTBalance(checkCtx, inv.PayAddress)
		}

		if err == nil && liveBalance > 0 {
			// Threshold: 98% of expected crypto amount to protect against minor fee/rounding variations
			threshold := inv.CryptoAmount * 0.98
			if threshold <= 0 {
				threshold = 0.000001
			}

			if liveBalance >= threshold {
				now := time.Now()
				if err := u.invoiceRepo.UpdateStatus(ctx, inv.ID, domain.StatusPaid, &now); err == nil {
					inv.Status = domain.StatusPaid
					inv.PaidAt = &now
					slog.Info("🎉 Invoice SETTLED on-chain by live balance detector!",
						"invoice", inv.InvoiceNumber,
						"address", inv.PayAddress,
						"balance", liveBalance,
						"required", inv.CryptoAmount,
					)

					if u.transactionRepo != nil {
						txHash := fmt.Sprintf("bsc-settled-%s-%d", inv.InvoiceNumber, now.Unix())
						_ = u.transactionRepo.RecordTransaction(ctx, &domain.ObservedTransaction{
							InvoiceID:     &inv.ID,
							NetworkID:     inv.NetworkID,
							TxHash:        txHash,
							ToAddress:     inv.PayAddress,
							Amount:        liveBalance,
							Confirmations: 1,
							Status:        "CONFIRMED",
							DetectedAt:    now,
							ConfirmedAt:   &now,
						})
					}
				}
			}
		} else {
			// If balance is currently 0, check if this wallet was already SWEPT (nonce > 0 on-chain)
			nonce, nonceErr := u.bscClient.GetNonce(checkCtx, inv.PayAddress)
			if nonceErr == nil && nonce > 0 {
				now := time.Now()
				if err := u.invoiceRepo.UpdateStatus(ctx, inv.ID, domain.StatusPaid, &now); err == nil {
					inv.Status = domain.StatusPaid
					inv.PaidAt = &now
					slog.Info("🎉 Invoice SETTLED because deposit address was SWEPT (nonce > 0)!",
						"invoice", inv.InvoiceNumber,
						"address", inv.PayAddress,
						"nonce", nonce,
					)
				}
			}
		}
	}

	// 3. Real on-chain check for TON
	if inv.NetworkID == "ton" && u.tonClient != nil && inv.PayMemo != nil && *inv.PayMemo != "" {
		checkCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		match, err := u.tonClient.CheckPayment(checkCtx, inv.PayAddress, *inv.PayMemo, inv.CryptoAmount, inv.CreatedAt)
		if err == nil && match != nil {
			now := time.Now()
			if err := u.invoiceRepo.UpdateStatus(ctx, inv.ID, domain.StatusPaid, &now); err == nil {
				inv.Status = domain.StatusPaid
				inv.PaidAt = &now
				slog.Info("🎉 TON Invoice SETTLED on-chain by live memo & amount detector!",
					"invoice", inv.InvoiceNumber,
					"memo", *inv.PayMemo,
					"amount", match.Amount,
					"required", inv.CryptoAmount,
					"tx_hash", match.TxHash,
					"from", match.FromAddress,
				)

				if u.transactionRepo != nil {
					_ = u.transactionRepo.RecordTransaction(ctx, &domain.ObservedTransaction{
						InvoiceID:     &inv.ID,
						NetworkID:     "ton",
						TxHash:        match.TxHash,
						ToAddress:     inv.PayAddress,
						Amount:        match.Amount,
						Memo:          inv.PayMemo,
						Confirmations: 1,
						Status:        "CONFIRMED",
						DetectedAt:    match.Timestamp,
						ConfirmedAt:   &now,
					})
				}
			}
		} else if err != nil {
			slog.Warn("TON on-chain check error", "memo", *inv.PayMemo, "address", inv.PayAddress, "err", err)
		}
	}
}

// StartBackgroundObserver starts a background loop to verify pending invoices on-chain periodically
func (u *InvoiceUseCase) StartBackgroundObserver(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				pending, err := u.invoiceRepo.ListPending(ctx)
				if err != nil {
					continue
				}
				for _, inv := range pending {
					u.checkOnChainSettlement(ctx, inv)
				}
			}
		}
	}()
	slog.Info("🚀 Background payment observer started (BSC & TON)", "interval", interval.String())
}

// GetLiveRates returns dynamic crypto exchange rates queried from Wallex API
func (u *InvoiceUseCase) GetLiveRates(ctx context.Context) map[string]float64 {
	return u.wallexClient.GetAllRates(ctx)
}


