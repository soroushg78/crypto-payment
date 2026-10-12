package wallex

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type CachedPrice struct {
	Price     float64
	UpdatedAt time.Time
}

type Client struct {
	httpClient *http.Client
	baseURL    string
	cache      map[string]CachedPrice
	cacheMu    sync.RWMutex
	cacheTTL   time.Duration
}

type CurrenciesStatsResponse struct {
	Success bool `json:"success"`
	Result  []struct {
		Key   string  `json:"key"`
		Name  string  `json:"name"`
		Price float64 `json:"price"`
	} `json:"result"`
	Message string `json:"message"`
}

func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 6 * time.Second,
		},
		baseURL:  "https://api.wallex.ir/v1/currencies/stats",
		cache:    make(map[string]CachedPrice),
		cacheTTL: 45 * time.Second, // Cache live price for 45 seconds
	}
}

// GetPriceUSD queries live price of cryptocurrency against USD from Wallex API
func (c *Client) GetPriceUSD(ctx context.Context, symbol string) (float64, error) {
	sym := strings.ToUpper(strings.TrimSpace(symbol))

	// USDT is pegged to USD (1.0)
	if sym == "USDT" || sym == "USD" {
		return 1.0, nil
	}

	// Legacy TON coin has migrated completely to GRAM
	if sym == "TON" || sym == "TONCOIN" {
		sym = "GRAM"
	}

	// 1. Check in-memory cache
	c.cacheMu.RLock()
	cached, found := c.cache[sym]
	c.cacheMu.RUnlock()

	if found && time.Since(cached.UpdatedAt) < c.cacheTTL && cached.Price > 0 {
		return cached.Price, nil
	}

	// 2. Fetch live price from Wallex public API (No API key needed)
	apiURL := fmt.Sprintf("%s?key=%s", c.baseURL, url.QueryEscape(sym))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		if found && cached.Price > 0 {
			return cached.Price, nil
		}
		return c.getFallbackPrice(sym), nil
	}
	req.Header.Set("User-Agent", "CryptoPaymentGateway/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		slog.Warn("Wallex API request error, using fallback/cached rate", "symbol", sym, "error", err)
		if found && cached.Price > 0 {
			return cached.Price, nil
		}
		return c.getFallbackPrice(sym), nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		slog.Warn("Wallex API non-200 status", "status", resp.StatusCode, "symbol", sym)
		if found && cached.Price > 0 {
			return cached.Price, nil
		}
		return c.getFallbackPrice(sym), nil
	}

	var statsResp CurrenciesStatsResponse
	if err := json.NewDecoder(resp.Body).Decode(&statsResp); err != nil {
		slog.Warn("Failed to decode Wallex API response", "symbol", sym, "error", err)
		if found && cached.Price > 0 {
			return cached.Price, nil
		}
		return c.getFallbackPrice(sym), nil
	}

	if statsResp.Success && len(statsResp.Result) > 0 && statsResp.Result[0].Price > 0 {
		price := statsResp.Result[0].Price
		// Update cache
		c.cacheMu.Lock()
		c.cache[sym] = CachedPrice{
			Price:     price,
			UpdatedAt: time.Now(),
		}
		c.cacheMu.Unlock()

		slog.Info("Fetched live rate from Wallex API", "symbol", sym, "priceUSD", price)
		return price, nil
	}

	if found && cached.Price > 0 {
		return cached.Price, nil
	}
	return c.getFallbackPrice(sym), nil
}

// GetAllRates returns live rates for all supported currencies
func (c *Client) GetAllRates(ctx context.Context) map[string]float64 {
	symbols := []string{"USDT", "BNB", "GRAM"}
	rates := make(map[string]float64)

	var wg sync.WaitGroup
	var mu sync.Mutex

	for _, s := range symbols {
		wg.Add(1)
		go func(sym string) {
			defer wg.Done()
			p, _ := c.GetPriceUSD(ctx, sym)
			mu.Lock()
			rates[sym] = p
			mu.Unlock()
		}(s)
	}

	wg.Wait()
	return rates
}

func (c *Client) getFallbackPrice(sym string) float64 {
	switch sym {
	case "BNB":
		return 745.0
	case "GRAM":
		return 1.39
	case "USDT":
		return 1.0
	default:
		return 1.0
	}
}
