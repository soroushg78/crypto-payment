package usecase_test

import (
	"testing"
	"time"

	"wallet-observer/internal/domain"
)

func TestInvoiceExpiration(t *testing.T) {
	inv := &domain.Invoice{
		Status:    domain.StatusPending,
		ExpiresAt: time.Now().Add(-1 * time.Minute),
	}
	if !inv.IsExpired() {
		t.Errorf("expected invoice to be expired")
	}

	activeInv := &domain.Invoice{
		Status:    domain.StatusPending,
		ExpiresAt: time.Now().Add(10 * time.Minute),
	}
	if activeInv.IsExpired() {
		t.Errorf("expected invoice to NOT be expired")
	}
}

func TestInvoiceStatusTransitions(t *testing.T) {
	inv := &domain.Invoice{
		InvoiceNumber: "INV-2026-TEST",
		AmountUSD:     10.0,
		CryptoAmount:  2.0,
		Status:        domain.StatusPending,
	}

	if inv.Status != domain.StatusPending {
		t.Errorf("expected status PENDING, got %s", inv.Status)
	}

	// Settle
	inv.Status = domain.StatusPaid
	now := time.Now()
	inv.PaidAt = &now

	if inv.Status != domain.StatusPaid {
		t.Errorf("expected status PAID, got %s", inv.Status)
	}
}
