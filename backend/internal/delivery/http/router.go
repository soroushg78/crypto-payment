package http

import (
	"net/http"
	"time"
)

func NewRouter(
	healthH *HealthHandler,
	catalogH *CatalogHandler,
	invoiceH *InvoiceHandler,
	authH *AuthHandler,
) http.Handler {
	mux := http.NewServeMux()

	// 1. Health check
	mux.HandleFunc("GET /health", healthH.HealthCheck)

	// 2. Authentication route with brute-force rate limiting (5 attempts/min)
	loginLimiter := NewRateLimiter(5, 1*time.Minute)
	mux.Handle("POST /api/v1/auth/login", loginLimiter(http.HandlerFunc(authH.Login)))

	// 3. Catalog routes (Services, Networks, Currencies)
	mux.HandleFunc("GET /api/v1/services", catalogH.ListServices)
	mux.HandleFunc("GET /api/v1/networks", catalogH.ListNetworks)
	mux.HandleFunc("GET /api/v1/networks/{network_id}/currencies", catalogH.ListCurrencies)

	// 4. Invoice routes
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
