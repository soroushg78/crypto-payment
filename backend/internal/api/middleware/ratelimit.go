package middleware

import (
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

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

	// Periodic background cleanup of expired records
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
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte(`{"success":false,"error":"تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً کمی بعد تلاش کنید."}`))
				return
			}

			rl.limits[ip] = append(valid, now)
			rl.mu.Unlock()

			next.ServeHTTP(w, r)
		})
	}
}
