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
)

type InvoiceUseCase struct {
	invoiceRepo     domain.InvoiceRepository
	serviceRepo     domain.ServiceRepository
	currencyRepo    domain.CurrencyRepository
	networkRepo     domain.NetworkRepository
	userRepo        domain.UserRepository
	addressRepo     domain.DepositAddressRepository
	transactionRepo domain.ObservedTransactionRepository
	bscClient       *bscrpc.Client
}

func NewInvoiceUseCase(
	invoiceRepo domain.InvoiceRepository,
	serviceRepo domain.ServiceRepository,
	currencyRepo domain.CurrencyRepository,
	networkRepo domain.NetworkRepository,
	userRepo domain.UserRepository,
	addressRepo domain.DepositAddressRepository,
	transactionRepo domain.ObservedTransactionRepository,
	bscClient *bscrpc.Client,
) *InvoiceUseCase {
	return &InvoiceUseCase{
		invoiceRepo:     invoiceRepo,
		serviceRepo:     serviceRepo,
		currencyRepo:    currencyRepo,
		networkRepo:     networkRepo,
		userRepo:        userRepo,
		addressRepo:     addressRepo,
		transactionRepo: transactionRepo,
		bscClient:       bscClient,
	}
}

func (u *InvoiceUseCase) CreateInvoice(ctx context.Context, input domain.CreateInvoiceInput) (*domain.Invoice, error) {
	// 1. Resolve Pricing
	amountUSD := input.AmountUSD
	if amountUSD <= 0 && input.CustomAmount > 0 {
		amountUSD = input.CustomAmount
	}

	var serviceID *string
	var serviceTitle string
	if input.ServiceID != nil && *input.ServiceID != "" {
		svc, err := u.serviceRepo.GetByID(ctx, *input.ServiceID)
		if err == nil && svc != nil {
			serviceID = &svc.ID
			serviceTitle = svc.Title
			if amountUSD <= 0 {
				amountUSD = svc.PriceUSD
			}
		}
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
		curr, err = u.currencyRepo.GetBySymbolAndNetwork(ctx, input.Currency, net.ID)
		if err != nil {
			return nil, fmt.Errorf("currency '%s' not supported on network '%s': %w", input.Currency, net.ID, err)
		}
	} else {
		return nil, fmt.Errorf("currency is required (e.g. usdt, bnb, ton)")
	}

	// 4. Resolve / Create User
	var userID *string
	var telegramUsername string
	if input.TelegramID != nil {
		user, err := u.userRepo.GetOrCreateByTelegramID(ctx, *input.TelegramID, input.Username, input.Username)
		if err == nil && user != nil {
			userID = &user.ID
			telegramUsername = user.Username
		}
	} else if input.Username != "" {
		cleanUsername := strings.TrimPrefix(input.Username, "@")
		user, err := u.userRepo.GetOrCreateByUsername(ctx, cleanUsername, cleanUsername)
		if err == nil && user != nil {
			userID = &user.ID
			telegramUsername = user.Username
		}
	}

	// 5. Calculate Crypto Pricing (Oracle / Live Rates)
	exchangeRate := 1.0
	switch strings.ToUpper(curr.Symbol) {
	case "TON":
		exchangeRate = 5.20 // ~ $5.20 / TON
	case "BNB":
		exchangeRate = 610.0 // ~ $610.00 / BNB
	case "USDT":
		exchangeRate = 1.0 // 1 USD = 1 USDT
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
	var orderIDPtr *string
	if input.OrderID != "" {
		trimmedOrder := strings.TrimSpace(input.OrderID)
		orderIDPtr = &trimmedOrder
	}
	var callbackURLPtr *string
	if input.CallbackURL != "" {
		trimmedURL := strings.TrimSpace(input.CallbackURL)
		callbackURLPtr = &trimmedURL
	}

	invoice := &domain.Invoice{
		InvoiceNumber:    invoiceNumber,
		UserID:           userID,
		ServiceID:        serviceID,
		CurrencyID:       curr.ID,
		NetworkID:        net.ID,
		AmountUSD:        amountUSD,
		CryptoAmount:     cryptoAmount,
		ExchangeRate:     exchangeRate,
		PayAddress:       depositAddr.Address,
		PayMemo:          depositAddr.Memo,
		Status:           domain.StatusPending,
		OrderID:          orderIDPtr,
		CallbackURL:      callbackURLPtr,
		ExpiresAt:        now.Add(30 * time.Minute),
		CreatedAt:        now,
		UpdatedAt:        now,
		ServiceTitle:     serviceTitle,
		CurrencySymbol:   curr.Symbol,
		NetworkName:      net.Name,
		TelegramUsername: telegramUsername,
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
		}
	}
}
