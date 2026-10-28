package middleware

import (
	"log/slog"
	"net/http"
)

// Recovery catches any panics in downstream handlers and responds with a 500 JSON error
func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				slog.Error("Recovered from panic in HTTP handler", "panic", rec)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(`{"success":false,"error":"internal server error"}`))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

