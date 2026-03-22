# harbinger/osint-tools — OSINT intelligence tools for SPECTER
#
# People:     Sherlock, maigret, holehe, phoneinfoga
# Infra:      theHarvester, recon-ng, shodan, censys
# Leaks:      h8mail, trufflehog, gitleaks
# Metadata:   exiftool
# Dorking:    photon

FROM golang:1.24-alpine AS go-builder

RUN apk add --no-cache git build-base

# Build Go tools individually so one failure doesn't block all
RUN go install -v github.com/sundowndev/phoneinfoga/v2@latest || true
RUN go install -v github.com/gitleaks/gitleaks/v8/cmd/gitleaks@latest || true

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    jq \
    git \
    whois \
    dnsutils \
    ca-certificates \
    libimage-exiftool-perl \
    && rm -rf /var/lib/apt/lists/*

# Copy Go tools from builder (use wildcard — some may have failed)
COPY --from=go-builder /go/bin/ /usr/local/bin/

# trufflehog — binary release (too large to compile in Alpine)
RUN curl -sSL "https://github.com/trufflesecurity/trufflehog/releases/latest/download/trufflehog_linux_amd64.tar.gz" \
    | tar xz -C /usr/local/bin trufflehog || \
    echo "trufflehog install skipped"

# Python OSINT tools
RUN pip install --no-cache-dir \
    sherlock-project \
    maigret \
    holehe \
    shodan \
    censys \
    h8mail \
    photon \
    requests \
    beautifulsoup4

# theHarvester — install from git for proper CLI entry point
RUN pip install --no-cache-dir git+https://github.com/laramies/theHarvester.git

# recon-ng
RUN pip install --no-cache-dir recon-ng || true

WORKDIR /work
CMD ["sleep", "infinity"]
