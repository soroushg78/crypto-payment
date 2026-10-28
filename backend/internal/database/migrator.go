package database

import (
	"context"
	"fmt"
	"io/fs"
	"log/slog"
	"sort"
	"strings"

	"wallet-observer/internal/database/schema"

	"github.com/jackc/pgx/v5/pgxpool"
)

// AutoMigrate orchestrates table creation, initial seeding and network synchronization
func AutoMigrate(ctx context.Context, pool *pgxpool.Pool, isTestnet bool) error {
	// 1. Create all tables in sequential order from embedded schemas
	if err := createTables(ctx, pool); err != nil {
		return fmt.Errorf("migration step [createTables] failed: %w", err)
	}

	// 2. Seed initial supported networks, currencies, user and admin
	if err := SeedInitialData(ctx, pool); err != nil {
		return fmt.Errorf("migration step [SeedInitialData] failed: %w", err)
	}

	// 3. Synchronize testnet vs mainnet mode
	if err := SyncNetworkMode(ctx, pool, isTestnet); err != nil {
		return fmt.Errorf("migration step [SyncNetworkMode] failed: %w", err)
	}

	return nil
}

// createTables reads and executes all embedded .sql files in sequential order
func createTables(ctx context.Context, pool *pgxpool.Pool) error {
	entries, err := fs.ReadDir(schema.SchemaFS, ".")
	if err != nil {
		return fmt.Errorf("failed reading embedded schema directory: %w", err)
	}

	// Ensure files are sorted sequentially by filename (001_..., 002_..., etc.)
	var sqlFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			sqlFiles = append(sqlFiles, entry.Name())
		}
	}
	sort.Strings(sqlFiles)

	for _, filename := range sqlFiles {
		content, err := fs.ReadFile(schema.SchemaFS, filename)
		if err != nil {
			return fmt.Errorf("failed reading schema file %s: %w", filename, err)
		}

		if _, err := pool.Exec(ctx, string(content)); err != nil {
			return fmt.Errorf("failed executing schema %s: %w", filename, err)
		}
	}

	slog.Info("All database schema tables created/verified successfully", "tables_count", len(sqlFiles))
	return nil
}

