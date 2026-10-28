package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"wallet-observer/internal/domain"
	"wallet-observer/internal/usecase"
)

type RebalanceHandler struct {
	rebalanceUC *usecase.RebalanceUseCase
}

func NewRebalanceHandler(rebalanceUC *usecase.RebalanceUseCase) *RebalanceHandler {
	return &RebalanceHandler{
		rebalanceUC: rebalanceUC,
	}
}

// ListWallets handles GET /api/v1/rebalance/wallets?network=bsc (or eth)
func (h *RebalanceHandler) ListWallets(w http.ResponseWriter, r *http.Request) {
	networkID := r.URL.Query().Get("network")
	if networkID == "" {
		networkID = "bsc"
	}

	wallets, err := h.rebalanceUC.ListWallets(r.Context(), networkID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    wallets,
	})
}

// SweepWallet handles POST /api/v1/rebalance/sweep
func (h *RebalanceHandler) SweepWallet(w http.ResponseWriter, r *http.Request) {
	var req domain.SweepRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid sweep request payload: "+err.Error())
		return
	}

	result, err := h.rebalanceUC.ExecuteSweep(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    result,
	})
}

// SweepBatch handles POST /api/v1/rebalance/sweep-batch
func (h *RebalanceHandler) SweepBatch(w http.ResponseWriter, r *http.Request) {
	var req domain.BatchSweepRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid batch sweep request payload: "+err.Error())
		return
	}

	results, err := h.rebalanceUC.ExecuteBatchSweep(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    results,
	})
}

// EstimateGas handles GET /api/v1/rebalance/estimate?index=1&asset=USDT&network=bsc
func (h *RebalanceHandler) EstimateGas(w http.ResponseWriter, r *http.Request) {
	indexStr := r.URL.Query().Get("index")
	asset := r.URL.Query().Get("asset")
	networkID := r.URL.Query().Get("network")
	if networkID == "" {
		networkID = "bsc"
	}
	treasuryAddress := r.URL.Query().Get("treasury_address")

	if indexStr == "" || asset == "" {
		writeError(w, http.StatusBadRequest, "Parameters 'index' and 'asset' are required")
		return
	}

	index, err := strconv.Atoi(indexStr)
	if err != nil || index < 1 {
		writeError(w, http.StatusBadRequest, "Invalid derivation index")
		return
	}

	estimate, err := h.rebalanceUC.EstimateGas(r.Context(), index, asset, treasuryAddress, networkID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    estimate,
	})
}

// SecuritySpecs handles GET /api/v1/rebalance/security
func (h *RebalanceHandler) SecuritySpecs(w http.ResponseWriter, r *http.Request) {
	specs := h.rebalanceUC.GetSecuritySpecs()

	writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    specs,
	})
}

// GetTONTreasury handles GET /api/v1/rebalance/ton
func (h *RebalanceHandler) GetTONTreasury(w http.ResponseWriter, r *http.Request) {
	status, err := h.rebalanceUC.GetTONTreasuryStatus(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    status,
	})
}

// ListRecords handles GET /api/v1/rebalance/records?limit=50
func (h *RebalanceHandler) ListRecords(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	records, err := h.rebalanceUC.ListRebalanceRecords(r.Context(), limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    records,
	})
}
