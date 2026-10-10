package ton

import (
	"context"
	"fmt"
	"time"

	"wallet-observer/internal/domain"
)

type Provider struct {
	endpoint string
	apiKey   string
}

func New(endpoint, apiKey string) *Provider {
	return &Provider{
		endpoint: endpoint,
		apiKey:   apiKey,
	}
}

func (p *Provider) Name() string {
	return "ton"
}

func (p *Provider) CreateInvoice(ctx context.Context, req domain.CreateInvoiceRequest) (*domain.InvoiceResponse, error) {
	// Skeleton implementation for TON native transfer / comment-based invoices
	// In production, this can generate a unique payload or query TON Center / Tonkeeper API
	paymentID := fmt.Sprintf("ton_%d", time.Now().UnixNano())
	testWalletAddress := "EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N"

	payURL := fmt.Sprintf("ton://transfer/%s?amount=%d&text=%s",
		testWalletAddress,
		int64(req.Amount*1e9), // nanoton
		req.OrderID,
	)

	return &domain.InvoiceResponse{
		ProviderPaymentID: paymentID,
		PayAddress:        testWalletAddress,
		PayURL:            payURL,
	}, nil
}

func (p *Provider) VerifyPayment(ctx context.Context, providerPaymentID string) (*domain.PaymentStatusResponse, error) {
	// In production, this checks the TON transaction history or blockchain observer
	return &domain.PaymentStatusResponse{
		Status: domain.StatusPending,
		TxHash: "",
	}, nil
}
