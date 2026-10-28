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
	"wallet-observer/internal/database"
	httpDelivery "wallet-observer/internal/delivery/http"
	"wallet-observer/internal/repository"
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
	pool, err := database.NewPool(ctx, cfg.Database)
	if err != nil {
		slog.Error("Failed to initialize database pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	// 5. Run Database Migrations, Seeds & Sync
	isTestnet := os.Getenv("IS_TESTNET") == "true"
	if err := database.AutoMigrate(ctx, pool, isTestnet); err != nil {
		slog.Warn("Failed running database auto-migrations", "error", err)
	}

	// 5.5. Initialize BSC & ETH HD Wallet Manager (BIP-44: Supports XPUB and Mnemonic)
	masterMnemonic := os.Getenv("BSC_MASTER_MNEMONIC")
	bscXPUB := os.Getenv("BSC_XPUB")
	hdManager, err := hdwallet.NewManagerFromConfig(bscXPUB, masterMnemonic)
	if err != nil {
		slog.Error("Failed to initialize HD wallet manager", "error", err)
		os.Exit(1)
	}
	if bscXPUB != "" {
		slog.Info("EVM HD-Wallet Manager initialized in PURE XPUB MODE (Zero-Key Security: m/44'/60'/0'/0)")
	} else {
		slog.Info("EVM HD-Wallet Manager initialized (BIP-44 standard)")
	}

	// 6. Initialize Separated Repositories (SOLID - SRP)
	networkRepo := repository.NewNetworkRepository(pool)
	currencyRepo := repository.NewCurrencyRepository(pool)
	userRepo := repository.NewUserRepository(pool)
	adminRepo := repository.NewAdminRepository(pool)
	addressRepo := repository.NewDepositAddressRepository(pool, hdManager)
	invoiceRepo := repository.NewInvoiceRepository(pool)
	transactionRepo := repository.NewObservedTransactionRepository(pool)
	rebalanceRecordRepo := repository.NewRebalanceRecordRepository(pool)

	// 6.5 Initialize BSC & ETH RPC Clients (Direct Node Connector with Dynamic Testnet Support)
	isTestnet = os.Getenv("IS_TESTNET") == "true"
	bscRPC := os.Getenv("BSC_RPC_ENDPOINT")
	bscClient := bscrpc.NewEVMClient("bsc", bscRPC, hdManager, isTestnet)
	if isTestnet {
		slog.Warn("BSC RPC Client initialized in TESTNET MODE (Chain ID: 97, Free Testnet BNB/USDT)")
	} else {
		slog.Info("BSC RPC Client initialized in MAINNET MODE (Chain ID: 56, Real BNB/USDT)")
	}

	ethRPC := os.Getenv("ETH_RPC_ENDPOINT")
	ethClient := bscrpc.NewEVMClient("eth", ethRPC, hdManager, isTestnet)
	if isTestnet {
		slog.Warn("Ethereum RPC Client initialized in TESTNET MODE (Chain ID: 11155111 Sepolia, Free Sepolia ETH/USDT)")
	} else {
		slog.Info("Ethereum RPC Client initialized in MAINNET MODE (Chain ID: 1, Real ETH/USDT)")
	}

	// 6.6 Initialize TON RPC Client (Toncenter Direct Node Connector with Dynamic Testnet Support)
	tonEndpoint := os.Getenv("TON_ENDPOINT")
	if isTestnet {
		if tonEndpoint == "" || tonEndpoint == "https://toncenter.com/api/v2" {
			tonEndpoint = "https://testnet.toncenter.com/api/v2"
		}
	} else {
		if tonEndpoint == "" || tonEndpoint == "https://testnet.toncenter.com/api/v2" {
			tonEndpoint = "https://toncenter.com/api/v2"
		}
	}
	tonAPIKey := os.Getenv("TON_API_KEY")
	tonClient := tonrpc.NewClient(tonEndpoint, tonAPIKey)
	if isTestnet {
		slog.Warn("TON RPC Client initialized in TESTNET MODE", "endpoint", tonEndpoint)
	} else {
		slog.Info("TON RPC Client initialized in MAINNET MODE", "endpoint", tonEndpoint)
	}

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
		ethClient,
		tonClient,
		wallexClient,
	)
	authUC := usecase.NewAuthUseCase(adminRepo)
	rebalanceUC := usecase.NewRebalanceUseCase(
		addressRepo,
		hdManager,
		bscClient,
		ethClient,
		invoiceRepo,
		tonClient,
		rebalanceRecordRepo,
	)

	// 7.5 Start Background On-Chain Payment Observer (BSC, ETH & TON auto-settlement every 10s)
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
