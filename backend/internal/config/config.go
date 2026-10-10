package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
	"time"
)

type ServerConfig struct {
	Port         string
	Host         string
	Env          string
	LogLevel     string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

type DatabaseConfig struct {
	URL             string
	MaxConns        int32
	MinConns        int32
	MaxConnLifetime time.Duration
	MaxConnIdleTime time.Duration
}

type ProviderConfig struct {
	TonAPIKey   string
	TonEndpoint string
}

type Config struct {
	Server    ServerConfig
	Database  DatabaseConfig
	Providers ProviderConfig
}

// Load reads configuration from .env file (if present) and environment variables with safe defaults.
func Load() *Config {
	loadDotEnv(".env")

	return &Config{
		Server: ServerConfig{
			Port:         getEnv("PORT", "8080"),
			Host:         getEnv("HOST", "0.0.0.0"),
			Env:          getEnv("APP_ENV", "development"),
			LogLevel:     getEnv("LOG_LEVEL", "info"),
			ReadTimeout:  time.Duration(getEnvAsInt("READ_TIMEOUT_SECONDS", 10)) * time.Second,
			WriteTimeout: time.Duration(getEnvAsInt("WRITE_TIMEOUT_SECONDS", 15)) * time.Second,
		},
		Database: DatabaseConfig{
			URL:             getEnv("DATABASE_URL", "postgres://postgres:postgres@127.0.0.1:5432/wallet_ledger?sslmode=disable"),
			MaxConns:        int32(getEnvAsInt("DB_MAX_CONNS", 25)),
			MinConns:        int32(getEnvAsInt("DB_MIN_CONNS", 5)),
			MaxConnLifetime: time.Duration(getEnvAsInt("DB_MAX_CONN_LIFETIME_MINUTES", 60)) * time.Minute,
			MaxConnIdleTime: time.Duration(getEnvAsInt("DB_MAX_CONN_IDLE_MINUTES", 15)) * time.Minute,
		},
		Providers: ProviderConfig{
			TonAPIKey:   getEnv("TON_API_KEY", ""),
			TonEndpoint: getEnv("TON_ENDPOINT", "https://toncenter.com/api/v2/jsonRPC"),
		},
	}
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && strings.TrimSpace(val) != "" {
		return val
	}
	return defaultVal
}

func getEnvAsInt(key string, defaultVal int) int {
	valStr := getEnv(key, "")
	if val, err := strconv.Atoi(valStr); err == nil {
		return val
	}
	return defaultVal
}

// loadDotEnv reads key-value pairs from .env and sets them if not already in environment
func loadDotEnv(filepath string) {
	file, err := os.Open(filepath)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			k := strings.TrimSpace(parts[0])
			v := strings.TrimSpace(parts[1])
			v = strings.Trim(v, `"'`)
			if _, exists := os.LookupEnv(k); !exists {
				_ = os.Setenv(k, v)
			}
		}
	}
}
