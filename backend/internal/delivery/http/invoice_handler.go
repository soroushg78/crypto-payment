package http

import (
	"encoding/json"
	"errors"
	"net/http"

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

	if req.ServiceID == "" || req.CurrencyID == "" || req.NetworkID == "" {
		writeError(w, http.StatusBadRequest, "service_id, currency_id, and network_id are required")
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
