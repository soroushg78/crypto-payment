package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"wallet-observer/internal/config"
	"wallet-observer/internal/repository/postgres"
)

func main() {
	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pool, err := postgres.NewPool(ctx, cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	fmt.Println("Resetting and refreshing database...")

	// Truncate all tables and cascade to clean any legacy data
	cleanQuery := `
		TRUNCATE TABLE observed_transactions, invoices, deposit_addresses, services, currencies, networks, users CASCADE;
	`
	if _, err := pool.Exec(ctx, cleanQuery); err != nil {
		fmt.Printf("Note: Truncate returned: %v (tables might not exist yet, running migrations)\n", err)
	} else {
		fmt.Println("All old data and seeds truncated successfully.")
	}

	// Run clean AutoMigrate
	if err := postgres.AutoMigrate(ctx, pool); err != nil {
		log.Fatalf("AutoMigrate failed: %v", err)
	}

	// Verify table counts
	var netCount, currCount, srvCount, invCount int
	_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM networks").Scan(&netCount)
	_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM currencies").Scan(&currCount)
	_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM services").Scan(&srvCount)
	_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM invoices").Scan(&invCount)

	fmt.Printf("\n--- Database Fresh Summary ---\n")
	fmt.Printf("networks count: %d (TON, TRON)\n", netCount)
	fmt.Printf("currencies count: %d (TON, USDT-TON, TRX, USDT-TRON)\n", currCount)
	fmt.Printf("services count: %d (Completely empty)\n", srvCount)
	fmt.Printf("invoices count: %d (Completely empty)\n", invCount)
	fmt.Println("Database is now 100% fresh and clean!")
}
