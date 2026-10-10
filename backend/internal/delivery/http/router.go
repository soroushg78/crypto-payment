package http

import (
	"net/http"
)

func NewRouter(
	healthH *HealthHandler,
	catalogH *CatalogHandler,
	invoiceH *InvoiceHandler,
) http.Handler {
	mux := http.NewServeMux()

	// 1. Health check
	mux.HandleFunc("GET /health", healthH.HealthCheck)

	// 2. Catalog routes (Services, Networks, Currencies)
	mux.HandleFunc("GET /api/v1/services", catalogH.ListServices)
	mux.HandleFunc("GET /api/v1/networks", catalogH.ListNetworks)
	mux.HandleFunc("GET /api/v1/networks/{network_id}/currencies", catalogH.ListCurrencies)

	// 3. Invoice routes
	mux.HandleFunc("POST /api/v1/invoices", invoiceH.CreateInvoice)
	mux.HandleFunc("GET /api/v1/invoices/{id}", invoiceH.GetInvoice)
	mux.HandleFunc("GET /api/v1/invoices/number/{number}", invoiceH.GetInvoiceByNumber)

	// Apply Middlewares in chain
	var handler http.Handler = mux
	handler = CorsMiddleware(handler)
	handler = LoggingMiddleware(handler)
	handler = RecoveryMiddleware(handler)

	return handler
}
