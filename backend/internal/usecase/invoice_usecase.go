package usecase

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"math"
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
	// 1. Validate Service
	svc, err := u.serviceRepo.GetByID(ctx, input.ServiceID)
	if err != nil {
		return nil, fmt.Errorf("service not found: %w", err)
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
	if input.TelegramID != nil {
		user, err := u.userRepo.GetOrCreateByTelegramID(ctx, *input.TelegramID, input.Username, input.Username)
		if err == nil && user != nil {
			userID = &user.ID
		}
	}

	// 5. Calculate Pricing & Amount
	amountUSD := svc.PriceUSD
	if input.CustomAmount > 0 {
		amountUSD = input.CustomAmount
	}

	exchangeRate := 1.0
	if curr.Symbol == "TON" {
		exchangeRate = 5.0 // Oracle / Fixed test rate
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
		ServiceID:      svc.ID,
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
		ServiceTitle:   svc.Title,
		CurrencySymbol: curr.Symbol,
		NetworkName:    net.Name,
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
