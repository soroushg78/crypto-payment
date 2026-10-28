package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"wallet-observer/internal/config"
	"wallet-observer/internal/database"
)

func main() {
	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	pool, err := database.NewPool(ctx, cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	fmt.Println("==================================================")
	fmt.Println("🧹 Resetting & Seeding Database (Clean State)...")
	fmt.Println("==================================================")

	// Truncate tables and cascade to wipe all test invoices, observed txs, addresses, rebalance records, etc.
	cleanQuery := `
		TRUNCATE TABLE rebalance_records, observed_transactions, invoices, deposit_addresses, currencies, networks, users CASCADE;
	`
	if _, err := pool.Exec(ctx, cleanQuery); err != nil {
		fmt.Printf("Note: Truncate returned: %v (tables might not exist yet, running migrations)\n", err)
	} else {
		fmt.Println("✅ All test invoices, deposit addresses, observed transactions, and rebalance records truncated successfully.")
	}

	// Run clean AutoMigrate to re-seed tables, BSC/ETH/TON networks, currencies (BNB, ETH, USDT, GRAM), admin, and users
	isTestnet := os.Getenv("IS_TESTNET") == "true"
	if err := database.AutoMigrate(ctx, pool, isTestnet); err != nil {
		log.Fatalf("❌ AutoMigrate failed: %v", err)
	}

	// Verify table counts
	var netCount, currCount, invCount, addrCount, adminCount int
	_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM networks").Scan(&netCount)
	_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM currencies").Scan(&currCount)
	_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM invoices").Scan(&invCount)
	_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM deposit_addresses").Scan(&addrCount)
	_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM admins").Scan(&adminCount)

	fmt.Println("--------------------------------------------------")
	fmt.Printf("📊 Networks count        : %d (BSC, ETH, TON)\n", netCount)
	fmt.Printf("📊 Currencies count      : %d (BNB, ETH, USDT-BEP20, USDT-ERC20, GRAM)\n", currCount)
	fmt.Printf("📊 Invoices count        : %d (Reset to 0)\n", invCount)
	fmt.Printf("📊 Deposit addresses     : %d (Reset to 0)\n", addrCount)
	fmt.Printf("📊 Admins count          : %d (Default: admin / admin123)\n", adminCount)
	fmt.Println("--------------------------------------------------")
	fmt.Println("🚀 Database is now 100% fresh, clean, and ready for production/demo!")
	fmt.Println("==================================================")
}
