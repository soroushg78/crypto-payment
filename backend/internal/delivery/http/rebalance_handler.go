package http

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

// ListWallets handles GET /api/v1/rebalance/wallets
func (h *RebalanceHandler) ListWallets(w http.ResponseWriter, r *http.Request) {
	wallets, err := h.rebalanceUC.ListBSCWallets(r.Context())
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
		writeError(w, http.StatusBadRequest, err.Error())
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
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    results,
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

// EstimateGas handles GET /api/v1/rebalance/estimate
func (h *RebalanceHandler) EstimateGas(w http.ResponseWriter, r *http.Request) {
	indexStr := r.URL.Query().Get("index")
	index, _ := strconv.Atoi(indexStr)
	asset := r.URL.Query().Get("asset")
	treasury := r.URL.Query().Get("treasury")

	estimate, err := h.rebalanceUC.EstimateGas(r.Context(), index, asset, treasury)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    estimate,
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

// ListRecords handles GET /api/v1/rebalance/records
func (h *RebalanceHandler) ListRecords(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit, _ := strconv.Atoi(limitStr)
	if limit <= 0 {
		limit = 100
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

