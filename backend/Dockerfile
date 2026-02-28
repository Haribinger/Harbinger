# Harbinger Go Backend API
# Multi-stage build: compile with full Go toolchain, run on minimal image

FROM golang:1.24-alpine AS builder

ARG VERSION=1.0.0

WORKDIR /app

RUN apk add --no-cache git ca-certificates

# Copy dependency manifests and download (cached layer)
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build — single command, no error suppression
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w -X main.version=${VERSION}" \
    -o /app/harbinger-api ./cmd

# ---- Runtime image ----
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata wget \
    && addgroup -S harbinger \
    && adduser -S harbinger -G harbinger

WORKDIR /app

COPY --from=builder --chown=harbinger:harbinger /app/harbinger-api .

RUN mkdir -p /app/config /app/logs /app/mcp-plugins \
    && chown -R harbinger:harbinger /app

USER harbinger

EXPOSE 8080
EXPOSE 9090

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=10s \
    CMD wget -qO- http://localhost:8080/api/v1/health || exit 1

CMD ["/app/harbinger-api"]
