package http

import (
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		slog.Info("HTTP Request",
			"method", r.Method,
			"path", r.URL.Path,
			"remote_addr", r.RemoteAddr,
			"duration", time.Since(start),
		)
	})
}

func RecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				slog.Error("Recovered from panic in HTTP handler", "panic", rec)
				writeError(w, http.StatusInternalServerError, "internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func CorsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

type ipRateLimiter struct {
	mu      sync.Mutex
	limits  map[string][]time.Time
	maxReqs int
	window  time.Duration
}

// NewRateLimiter creates an in-memory IP rate limiter to protect against brute force attacks
func NewRateLimiter(maxReqs int, window time.Duration) func(http.Handler) http.Handler {
	rl := &ipRateLimiter{
		limits:  make(map[string][]time.Time),
		maxReqs: maxReqs,
		window:  window,
	}

	// periodic cleanup of old records
	go func() {
		ticker := time.NewTicker(window * 2)
		for range ticker.C {
			rl.mu.Lock()
			now := time.Now()
			for ip, times := range rl.limits {
				var valid []time.Time
				for _, t := range times {
					if now.Sub(t) <= window {
						valid = append(valid, t)
					}
				}
				if len(valid) == 0 {
					delete(rl.limits, ip)
				} else {
					rl.limits[ip] = valid
				}
			}
			rl.mu.Unlock()
		}
	}()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.Header.Get("X-Forwarded-For")
			if ip == "" {
				ip = r.RemoteAddr
				if host, _, err := net.SplitHostPort(ip); err == nil {
					ip = host
				}
			} else {
				parts := strings.Split(ip, ",")
				ip = strings.TrimSpace(parts[0])
			}

			rl.mu.Lock()
			now := time.Now()
			times := rl.limits[ip]
			var valid []time.Time
			for _, t := range times {
				if now.Sub(t) <= window {
					valid = append(valid, t)
				}
			}

			if len(valid) >= rl.maxReqs {
				rl.mu.Unlock()
				w.Header().Set("Retry-After", fmt.Sprintf("%d", int(window.Seconds())))
				writeError(w, http.StatusTooManyRequests, "Too many login attempts. Please try again later.")
				return
			}

			rl.limits[ip] = append(valid, now)
			rl.mu.Unlock()

			next.ServeHTTP(w, r)
		})
	}
}
