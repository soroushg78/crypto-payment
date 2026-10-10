package usecase

import (
	"context"
	"log/slog"
	"time"

	"wallet-observer/internal/domain"
)

type SettlementUseCase struct {
	invoiceRepo     domain.InvoiceRepository
	transactionRepo domain.ObservedTransactionRepository
}

func NewSettlementUseCase(
	invoiceRepo domain.InvoiceRepository,
	transactionRepo domain.ObservedTransactionRepository,
) *SettlementUseCase {
	return &SettlementUseCase{
		invoiceRepo:     invoiceRepo,
		transactionRepo: transactionRepo,
	}
}

// ProcessObservedPayment verifies incoming transactions and settles pending invoices
func (u *SettlementUseCase) ProcessObservedPayment(
	ctx context.Context,
	networkID, txHash, toAddress string,
	memo *string,
	amount float64,
) error {
	// 1. Prevent duplicate processing (Double-Spend check)
	exists, err := u.transactionRepo.Exists(ctx, networkID, txHash)
	if err != nil {
		return err
	}
	if exists {
		slog.Warn("Transaction already processed, skipping", "network", networkID, "tx", txHash)
		return nil
	}

	// 2. Fetch pending invoices
	pendingList, err := u.invoiceRepo.ListPending(ctx)
	if err != nil {
		return err
	}

	var matched *domain.Invoice
	for _, inv := range pendingList {
		if inv.NetworkID == networkID && inv.PayAddress == toAddress {
			if memo != nil && inv.PayMemo != nil && *memo == *inv.PayMemo {
				matched = inv
				break
			}
		}
	}

	now := time.Now()
	var invoiceID *string
	if matched != nil {
		invoiceID = &matched.ID
		newStatus := domain.StatusPaid
		if amount < matched.CryptoAmount {
			newStatus = domain.StatusUnderpaid
		}
		_ = u.invoiceRepo.UpdateStatus(ctx, matched.ID, newStatus, &now)
		slog.Info("Invoice settled by observer", "id", matched.ID, "status", newStatus, "tx", txHash)
	}

	// 3. Record in observed_transactions
	tx := &domain.ObservedTransaction{
		InvoiceID:     invoiceID,
		NetworkID:     networkID,
		TxHash:        txHash,
		ToAddress:     toAddress,
		Amount:        amount,
		Memo:          memo,
		Confirmations: 1,
		Status:        "CONFIRMED",
		DetectedAt:    now,
		ConfirmedAt:   &now,
	}
	return u.transactionRepo.RecordTransaction(ctx, tx)
}
