package domain

import "time"

// User represents a customer (from Web or Telegram Bot)
type User struct {
	ID         string    `json:"id"`
	TelegramID *int64    `json:"telegram_id,omitempty"`
	Username   string    `json:"username,omitempty"`
	FirstName  string    `json:"first_name,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

// Admin represents a dashboard administrator
type Admin struct {
	ID          string     `json:"id"`
	Username    string     `json:"username"`
	Role        string     `json:"role"`
	TelegramID  *int64     `json:"telegram_id,omitempty"`
	IsActive    bool       `json:"is_active"`
	CreatedAt   time.Time  `json:"created_at"`
	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
}

type LoginInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token     string    `json:"token"`
	Admin     *Admin    `json:"admin"`
	ExpiresAt time.Time `json:"expires_at"`
	ExpiresIn int       `json:"expires_in"` // in seconds: 86400 (24 hours)
}
