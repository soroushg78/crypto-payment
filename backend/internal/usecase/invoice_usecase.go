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
)

type InvoiceUseCase struct {
	invoiceRepo domain.InvoiceRepository
	serviceRepo domain.ServiceRepository
	currencyRepo domain.CurrencyRepository
	networkRepo domain.NetworkRepository
	userRepo    domain.UserRepository
	addressRepo domain.DepositAddressRepository
}

func NewInvoiceUseCase(
	invoiceRepo domain.InvoiceRepository,
	serviceRepo domain.ServiceRepository,
	currencyRepo domain.CurrencyRepository,
	networkRepo domain.NetworkRepository,
	userRepo domain.UserRepository,
	addressRepo domain.DepositAddressRepository,
) *InvoiceUseCase {
	return &InvoiceUseCase{
		invoiceRepo:  invoiceRepo,
		serviceRepo:  serviceRepo,
		currencyRepo: currencyRepo,
		networkRepo:  networkRepo,
		userRepo:     userRepo,
		addressRepo:  addressRepo,
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

	// 2. Validate Currency
	curr, err := u.currencyRepo.GetByID(ctx, input.CurrencyID)
	if err != nil {
		return nil, fmt.Errorf("currency not found: %w", err)
	}

	// 3. Validate Network
	net, err := u.networkRepo.GetByID(ctx, input.NetworkID)
	if err != nil {
		return nil, fmt.Errorf("network not found: %w", err)
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

	// 5. Calculate Crypto Pricing
	exchangeRate := 1.0
	if curr.Symbol == "TON" {
		exchangeRate = 5.0 // Oracle / Fixed test rate
	} else if curr.Symbol == "TRX" {
		exchangeRate = 0.15
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
		InvoiceNumber:  invoiceNumber,
		UserID:         userID,
		ServiceID:      serviceID,
		CurrencyID:     curr.ID,
		NetworkID:      net.ID,
		AmountUSD:      amountUSD,
		CryptoAmount:   cryptoAmount,
		ExchangeRate:   exchangeRate,
		PayAddress:     depositAddr.Address,
		PayMemo:        depositAddr.Memo,
		Status:         domain.StatusPending,
		ExpiresAt:      now.Add(30 * time.Minute),
		CreatedAt:      now,
		UpdatedAt:      now,
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
	return u.invoiceRepo.GetByID(ctx, id)
}

func (u *InvoiceUseCase) GetInvoiceByNumber(ctx context.Context, num string) (*domain.Invoice, error) {
	return u.invoiceRepo.GetByNumber(ctx, num)
}
