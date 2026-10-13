# Build stage
FROM golang:alpine AS builder

# Install ca-certificates and git in case needed
RUN apk add --no-cache ca-certificates git

WORKDIR /app

# Leverage Docker cache for Go modules
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the Go binary (statically linked, stripped symbols)
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/crypto-service ./cmd/api

# Final runtime stage
FROM alpine:latest

# Install ca-certificates and tzdata for secure TLS and accurate time
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Run as non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy the compiled binary from builder
COPY --from=builder /app/crypto-service /app/crypto-service

# Expose default HTTP service port
EXPOSE 8080

# Run the API service
ENTRYPOINT ["/app/crypto-service"]
