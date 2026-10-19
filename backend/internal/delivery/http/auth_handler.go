package http

import (
	"encoding/json"
	"net/http"

	"wallet-observer/internal/domain"
	"wallet-observer/internal/usecase"
)

type AuthHandler struct {
	authUC *usecase.AuthUseCase
}

func NewAuthHandler(authUC *usecase.AuthUseCase) *AuthHandler {
	return &AuthHandler{authUC: authUC}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req domain.LoginInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "فرمت داده‌های ارسالی نامعتبر است")
		return
	}

	res, err := h.authUC.Login(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	// Set 24-hour HTTP cookie for browser session persistence
	http.SetCookie(w, &http.Cookie{
		Name:     "crypto_admin_session",
		Value:    res.Token,
		Path:     "/",
		MaxAge:   86400, // 24 hours in seconds
		Expires:  res.ExpiresAt,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    res,
	})
}
