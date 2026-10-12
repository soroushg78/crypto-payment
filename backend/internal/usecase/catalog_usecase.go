package usecase

import (
	"context"

	"wallet-observer/internal/domain"
)

type CatalogUseCase struct {
	networkRepo  domain.NetworkRepository
	currencyRepo domain.CurrencyRepository
}

func NewCatalogUseCase(
	networkRepo domain.NetworkRepository,
	currencyRepo domain.CurrencyRepository,
) *CatalogUseCase {
	return &CatalogUseCase{
		networkRepo:  networkRepo,
		currencyRepo: currencyRepo,
	}
}

func (u *CatalogUseCase) ListNetworks(ctx context.Context) ([]*domain.Network, error) {
	return u.networkRepo.ListActive(ctx)
}

func (u *CatalogUseCase) ListCurrencies(ctx context.Context, networkID string) ([]*domain.Currency, error) {
	return u.currencyRepo.ListByNetwork(ctx, networkID)
}
