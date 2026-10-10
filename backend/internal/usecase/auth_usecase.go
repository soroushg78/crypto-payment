package usecase

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"wallet-observer/internal/domain"

	"golang.org/x/crypto/bcrypt"
)

type AuthUseCase struct {
	adminRepo domain.AdminRepository
}

func NewAuthUseCase(adminRepo domain.AdminRepository) *AuthUseCase {
	return &AuthUseCase{adminRepo: adminRepo}
}

// Login validates admin credentials using bcrypt and issues a session token
func (u *AuthUseCase) Login(ctx context.Context, input domain.LoginInput) (*domain.LoginResponse, error) {
	username := strings.TrimSpace(input.Username)
	if username == "" || input.Password == "" {
		return nil, errors.New("نام کاربری و رمز عبور الزامی است")
	}

	admin, passwordHash, err := u.adminRepo.GetByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, errors.New("نام کاربری یا رمز عبور اشتباه است")
		}
		return nil, fmt.Errorf("خطا در بررسی مشخصات: %w", err)
	}

	if !admin.IsActive {
		return nil, errors.New("این حساب کاربری غیرفعال شده است")
	}

	// Compare bcrypt hash
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(input.Password)); err != nil {
		slog.Warn("Failed admin login attempt", "username", username)
		return nil, errors.New("نام کاربری یا رمز عبور اشتباه است")
	}

	// Update last login timestamp
	_ = u.adminRepo.UpdateLastLogin(ctx, admin.ID)

	// Generate secure session token
	tokenBytes := make([]byte, 32)
	_, _ = rand.Read(tokenBytes)
	sessionToken := fmt.Sprintf("adm_tok_%s", hex.EncodeToString(tokenBytes))

	slog.Info("Admin logged in successfully", "username", admin.Username, "role", admin.Role)

	return &domain.LoginResponse{
		Token: sessionToken,
		Admin: admin,
	}, nil
}
