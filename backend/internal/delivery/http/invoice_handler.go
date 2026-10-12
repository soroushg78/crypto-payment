package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"wallet-observer/internal/domain"
	"wallet-observer/internal/usecase"
)

type InvoiceHandler struct {
	invoiceUC *usecase.InvoiceUseCase
}

func NewInvoiceHandler(invoiceUC *usecase.InvoiceUseCase) *InvoiceHandler {
	return &InvoiceHandler{invoiceUC: invoiceUC}
}

func (h *InvoiceHandler) CreateInvoice(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateInvoiceInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request JSON body")
		return
	}

	hasNetwork := req.NetworkID != "" || req.Network != ""
	hasCurrency := req.CurrencyID != "" || req.Currency != ""
	hasAmount := req.AmountUSD > 0 || req.CustomAmount > 0
	hasTelegram := req.TelegramID != nil || strings.TrimSpace(req.Username) != ""
	if !hasNetwork || !hasCurrency || !hasAmount || !hasTelegram {
		writeError(w, http.StatusBadRequest, "network, currency, amount_usd, and telegram identifier (telegram_id or username) are required")
		return
	}

	invoice, err := h.invoiceUC.CreateInvoice(r.Context(), req)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, APIResponse{
		Success: true,
		Data:    invoice,
	})
}

func (h *InvoiceHandler) GetInvoice(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "id parameter is required")
		return
	}

	invoice, err := h.invoiceUC.GetInvoice(r.Context(), id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "invoice not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    invoice,
	})
}

func (h *InvoiceHandler) GetInvoiceByNumber(w http.ResponseWriter, r *http.Request) {
	num := r.PathValue("number")
	if num == "" {
		writeError(w, http.StatusBadRequest, "number parameter is required")
		return
	}

	invoice, err := h.invoiceUC.GetInvoiceByNumber(r.Context(), num)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "invoice not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    invoice,
	})
}

// ListInvoices handles GET /api/v1/invoices
func (h *InvoiceHandler) ListInvoices(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit, _ := strconv.Atoi(limitStr)
	if limit <= 0 {
		limit = 50
	}

	invoices, err := h.invoiceUC.ListInvoices(r.Context(), limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    invoices,
	})
}

// GetRates handles GET /api/v1/rates - returns live crypto prices from Wallex
func (h *InvoiceHandler) GetRates(w http.ResponseWriter, r *http.Request) {
	rates := h.invoiceUC.GetLiveRates(r.Context())
	writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    rates,
	})
}

