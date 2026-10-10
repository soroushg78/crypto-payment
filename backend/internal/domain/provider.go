package domain

import "context"

type PaymentStatus = InvoiceStatus

type CreateInvoiceRequest struct {
	OrderID     string
	Amount      float64
	Currency    string
	Network     string
	Description string
}

type InvoiceResponse struct {
	ProviderPaymentID string
	PayAddress        string
	PayURL            string
}

type PaymentStatusResponse struct {
	Status InvoiceStatus
	TxHash string
}

type PaymentProvider interface {
	Name() string
	CreateInvoice(ctx context.Context, req CreateInvoiceRequest) (*InvoiceResponse, error)
	VerifyPayment(ctx context.Context, providerPaymentID string) (*PaymentStatusResponse, error)
}
