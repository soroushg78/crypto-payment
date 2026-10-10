package http

import (
	"net/http"

	"wallet-observer/internal/usecase"
)

type CatalogHandler struct {
	catalogUC *usecase.CatalogUseCase
}

func NewCatalogHandler(catalogUC *usecase.CatalogUseCase) *CatalogHandler {
	return &CatalogHandler{catalogUC: catalogUC}
}

func (h *CatalogHandler) ListServices(w http.ResponseWriter, r *http.Request) {
	services, err := h.catalogUC.ListServices(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    services,
	})
}

func (h *CatalogHandler) ListNetworks(w http.ResponseWriter, r *http.Request) {
	networks, err := h.catalogUC.ListNetworks(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    networks,
	})
}

func (h *CatalogHandler) ListCurrencies(w http.ResponseWriter, r *http.Request) {
	networkID := r.PathValue("network_id")
	if networkID == "" {
		writeError(w, http.StatusBadRequest, "network_id parameter is required")
		return
	}

	currencies, err := h.catalogUC.ListCurrencies(r.Context(), networkID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    currencies,
	})
}
