# Build stage - use Debian for glibc compatibility with go-libsql
FROM golang:1.21-bookworm AS builder

WORKDIR /app

# Install build dependencies for CGO
RUN apt-get update && apt-get install -y gcc libc6-dev && rm -rf /var/lib/apt/lists/*

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build with CGO enabled for libsql
ENV CGO_ENABLED=1
RUN go build -ldflags="-s -w" -o server ./cmd/server

# Final stage - use Debian slim for glibc compatibility
FROM debian:bookworm-slim

# Install ca-certificates for HTTPS
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary
COPY --from=builder /app/server .

# Create data directory for SQLite
RUN mkdir -p /data

# Expose port
EXPOSE 8080

# Run server
CMD ["/app/server"]
