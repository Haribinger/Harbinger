FROM golang:1.24-alpine AS builder
WORKDIR /build
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /mockhunter .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates python3 py3-pip git && \
    pip3 install --break-system-packages bandit 2>/dev/null || true
COPY --from=builder /mockhunter /usr/local/bin/mockhunter
WORKDIR /scan
ENTRYPOINT ["mockhunter"]
CMD ["--dir", "/scan", "--min-severity", "medium"]
