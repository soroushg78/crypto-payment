package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"wallet-observer/internal/config"
	httpDelivery "wallet-observer/internal/delivery/http"
	"wallet-observer/internal/repository/postgres"
	"wallet-observer/internal/usecase"
	"wallet-observer/pkg/bscrpc"
	"wallet-observer/pkg/hdwallet"
	"wallet-observer/pkg/logger"
	"wallet-observer/pkg/tonrpc"
	"wallet-observer/pkg/wallex"
)

func main() {
	// 1. Load Configurations
	cfg := config.Load()

	// 2. Initialize Structured Logger
	_ = logger.Init(cfg.Server.Env, cfg.Server.LogLevel)
	slog.Info("Starting Crypto Service...", "env", cfg.Server.Env)

	// 3. Setup Root Context with Graceful Shutdown Signals
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// 4. Initialize PostgreSQL Connection Pool
	pool, err := postgres.NewPool(ctx, cfg.Database)
	if err != nil {
		slog.Error("Failed to initialize database pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	// 5. Run Database Migrations & Seeds
	if err := postgres.AutoMigrate(ctx, pool); err != nil {
		slog.Warn("Failed running database auto-migrations", "error", err)
	}

	// 5.5. Initialize BSC HD Wallet Manager (BIP-44)
	masterMnemonic := os.Getenv("BSC_MASTER_MNEMONIC")
	hdManager, err := hdwallet.NewManager(masterMnemonic)
	if err != nil {
		slog.Error("Failed to initialize HD wallet manager", "error", err)
		os.Exit(1)
	}
	slog.Info("BSC HD-Wallet Manager initialized (BIP-44 standard)")

	// 6. Initialize Separated Repositories (SOLID - SRP)
	networkRepo := postgres.NewNetworkRepository(pool)
	currencyRepo := postgres.NewCurrencyRepository(pool)
	userRepo := postgres.NewUserRepository(pool)
	adminRepo := postgres.NewAdminRepository(pool)
	addressRepo := postgres.NewDepositAddressRepository(pool, hdManager)
	invoiceRepo := postgres.NewInvoiceRepository(pool)
	transactionRepo := postgres.NewObservedTransactionRepository(pool)
	rebalanceRecordRepo := postgres.NewRebalanceRecordRepository(pool)

	// 6.5 Initialize BSC RPC Client (Direct Node Connector)
	bscClient := bscrpc.NewClient("", hdManager)

	// 6.6 Initialize TON RPC Client (Toncenter Direct Node Connector)
	tonEndpoint := os.Getenv("TON_ENDPOINT")
	tonAPIKey := os.Getenv("TON_API_KEY")
	tonClient := tonrpc.NewClient(tonEndpoint, tonAPIKey)
	slog.Info("TON RPC Client initialized (Toncenter live node connector)")

	// 6.7 Initialize Wallex Price Oracle Client (Public Market API)
	wallexClient := wallex.NewClient()
	slog.Info("Wallex Live Price Oracle initialized (wallex.ir public market data)")

	// 7. Initialize Separated Use Cases (SOLID - SRP)
	catalogUC := usecase.NewCatalogUseCase(networkRepo, currencyRepo)
	invoiceUC := usecase.NewInvoiceUseCase(
		invoiceRepo,
		currencyRepo,
		networkRepo,
		userRepo,
		addressRepo,
		transactionRepo,
		bscClient,
		tonClient,
		wallexClient,
	)
	authUC := usecase.NewAuthUseCase(adminRepo)
	rebalanceUC := usecase.NewRebalanceUseCase(addressRepo, hdManager, bscClient, invoiceRepo, tonClient, rebalanceRecordRepo)

	// 7.5 Start Background On-Chain Payment Observer (BSC & TON auto-settlement every 10s)
	invoiceUC.StartBackgroundObserver(ctx, 10*time.Second)

	// 8. Initialize Separated HTTP Handlers (SOLID - SRP)
	healthHandler := httpDelivery.NewHealthHandler()
	catalogHandler := httpDelivery.NewCatalogHandler(catalogUC)
	invoiceHandler := httpDelivery.NewInvoiceHandler(invoiceUC)
	authHandler := httpDelivery.NewAuthHandler(authUC)
	rebalanceHandler := httpDelivery.NewRebalanceHandler(rebalanceUC)

	// 9. Wire Router with Handlers & Middlewares
	router := httpDelivery.NewRouter(healthHandler, catalogHandler, invoiceHandler, authHandler, rebalanceHandler)

	addr := fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port)
	server := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	// 10. Start Server asynchronously
	go func() {
		slog.Info("HTTP server listening", "address", addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("HTTP server failed", "error", err)
			stop()
		}
	}()

	// 11. Wait for Shutdown Signal
	<-ctx.Done()
	slog.Info("Shutdown signal received, shutting down gracefully...")

	// 12. Graceful Shutdown HTTP Server with 10s Timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("HTTP server forced to shutdown", "error", err)
	}

	slog.Info("Service gracefully stopped.")
}
