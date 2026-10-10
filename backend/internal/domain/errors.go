package domain

import "errors"

var (
	ErrNotFound       = errors.New("record not found")
	ErrAlreadyExists  = errors.New("record already exists")
	ErrPaymentExpired = errors.New("payment has expired")
	ErrInvalidAmount  = errors.New("amount must be greater than zero")
	ErrInvalidStatus  = errors.New("invalid status transition")
	ErrProviderFailed = errors.New("payment provider failure")
	ErrUnauthorized   = errors.New("unauthorized")
)
