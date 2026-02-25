# Harbinger Go Backend API
# Multi-stage build: compile with full Go toolchain, run on minimal image
FROM golang:1.24-alpine AS builder

ARG VERSION=1.0.0

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Copy go mod files and download dependencies
COPY go.mod ./
RUN go mod download 2>/dev/null || true

# Copy source
COPY . .

# Build the binary - compile the entire cmd package (includes skills, handlers, etc.)
RUN go build -ldflags="-s -w -X main.version=${VERSION}" -o /app/harbinger-api ./cmd 2>/dev/null || \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/harbinger-api ./cmd

# ---- Runtime image ----
FROM alpine:3.21

RUN apk add --no-cache ca-certificates curl tzdata

WORKDIR /app

COPY --from=builder /app/harbinger-api .

# Create config and log directories
RUN mkdir -p /app/config /app/logs /app/mcp-plugins

EXPOSE 8080
EXPOSE 9090

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8080/api/v1/health || exit 1

CMD ["/app/harbinger-api"]
