package usecase

import (
	"context"

	"wallet-observer/internal/domain"
)

type CatalogUseCase struct {
	serviceRepo  domain.ServiceRepository
	networkRepo  domain.NetworkRepository
	currencyRepo domain.CurrencyRepository
}

func NewCatalogUseCase(
	serviceRepo domain.ServiceRepository,
	networkRepo domain.NetworkRepository,
	currencyRepo domain.CurrencyRepository,
) *CatalogUseCase {
	return &CatalogUseCase{
		serviceRepo:  serviceRepo,
		networkRepo:  networkRepo,
		currencyRepo: currencyRepo,
	}
}

func (u *CatalogUseCase) ListServices(ctx context.Context) ([]*domain.Service, error) {
	return u.serviceRepo.ListActive(ctx)
}

func (u *CatalogUseCase) GetService(ctx context.Context, id string) (*domain.Service, error) {
	return u.serviceRepo.GetByID(ctx, id)
}

func (u *CatalogUseCase) ListNetworks(ctx context.Context) ([]*domain.Network, error) {
	return u.networkRepo.ListActive(ctx)
}

func (u *CatalogUseCase) ListCurrencies(ctx context.Context, networkID string) ([]*domain.Currency, error) {
	return u.currencyRepo.ListByNetwork(ctx, networkID)
}
