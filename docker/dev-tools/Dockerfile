# harbinger/dev-tools — Code analysis + development tools for SAM and MAINTAINER
#
# Static analysis: semgrep, bandit, gosec, njsscan
# Secret scanning: gitleaks, trufflehog
# Dependency/SCA:  osv-scanner, grype, trivy
# Runtimes:        python3, node22, go1.24

FROM golang:1.24 AS go-builder

# Build Go security tools
RUN go install -v github.com/gitleaks/gitleaks/v8/cmd/gitleaks@latest && \
    go install -v github.com/securego/gosec/v2/cmd/gosec@latest && \
    go install -v github.com/google/osv-scanner/cmd/osv-scanner@latest && \
    go install -v github.com/trufflesecurity/trufflehog/v3@latest && \
    go install -v github.com/sw33tLie/bbscope@latest && \
    go install -v github.com/Haribinger/Harbinger/tools/mockhunter@latest || true

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    jq \
    git \
    build-essential \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Node.js LTS
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Go runtime (for running Go tools and building user code)
COPY --from=go-builder /usr/local/go /usr/local/go
ENV PATH="/usr/local/go/bin:${PATH}"

# Copy pre-built Go security tools
COPY --from=go-builder /go/bin/gitleaks /usr/local/bin/
COPY --from=go-builder /go/bin/gosec /usr/local/bin/
COPY --from=go-builder /go/bin/osv-scanner /usr/local/bin/
COPY --from=go-builder /go/bin/trufflehog /usr/local/bin/

# Python security tools
RUN pip install --no-cache-dir \
    semgrep \
    bandit \
    njsscan \
    requests \
    beautifulsoup4 \
    pycryptodome

# Grype (container/filesystem vuln scanner)
RUN curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin

# Node security tools
RUN npm install -g retire

WORKDIR /work
CMD ["sleep", "infinity"]
