# harbinger/pd-tools — Recon + scanning tools for PATHFINDER and BREACH
#
# Multi-stage build: binary releases for heavy tools, go install for lightweight.
#
# ProjectDiscovery: nuclei, subfinder, httpx, katana, naabu, interactsh,
#                   cvemap, uncover, dnsx, alterx, tlsx, asnmap, cdncheck, mapcidr
# Community:        gau, puredns, gf, anew, qsreplace, unfurl, hakrawler

FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git build-base libpcap-dev unzip curl

# Helper: download PD binary release by repo name
# PD uses versioned filenames: tool_X.Y.Z_linux_amd64.zip
RUN mkdir -p /pd-bin

# Heavy PD tools — binary releases to avoid OOM on constrained systems
RUN for TOOL in nuclei subfinder httpx katana naabu; do \
      REPO="projectdiscovery/$TOOL"; \
      [[ "$TOOL" == "nuclei" ]] && REPO="projectdiscovery/nuclei"; \
      URL=$(curl -sL "https://api.github.com/repos/$REPO/releases/latest" \
        | grep -o '"browser_download_url": "[^"]*linux_amd64.zip"' | head -1 | cut -d'"' -f4); \
      echo "Downloading $TOOL from $URL"; \
      curl -sSLf -o /tmp/$TOOL.zip "$URL" && \
      unzip -o /tmp/$TOOL.zip -d /tmp/$TOOL-out && \
      find /tmp/$TOOL-out -maxdepth 1 -type f -executable -exec cp {} /pd-bin/ \; && \
      rm -rf /tmp/$TOOL.zip /tmp/$TOOL-out; \
    done

# interactsh-client — different repo name pattern
RUN URL=$(curl -sL "https://api.github.com/repos/projectdiscovery/interactsh/releases/latest" \
      | grep -o '"browser_download_url": "[^"]*linux_amd64.zip"' | head -1 | cut -d'"' -f4) && \
    curl -sSLf -o /tmp/interactsh.zip "$URL" && \
    unzip -o /tmp/interactsh.zip -d /tmp/interactsh-out && \
    find /tmp/interactsh-out -name "interactsh-client" -exec cp {} /pd-bin/ \; && \
    rm -rf /tmp/interactsh.zip /tmp/interactsh-out

# Lightweight PD tools — small enough to compile
RUN CGO_ENABLED=0 go install -v github.com/projectdiscovery/cvemap/cmd/cvemap@latest && \
    go install -v github.com/projectdiscovery/uncover/cmd/uncover@latest && \
    go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@latest && \
    go install -v github.com/projectdiscovery/alterx/cmd/alterx@latest && \
    go install -v github.com/projectdiscovery/tlsx/cmd/tlsx@latest && \
    go install -v github.com/projectdiscovery/asnmap/cmd/asnmap@latest && \
    go install -v github.com/projectdiscovery/cdncheck/cmd/cdncheck@latest && \
    go install -v github.com/projectdiscovery/mapcidr/cmd/mapcidr@latest && \
    go install -v github.com/projectdiscovery/notify/cmd/notify@latest

# Community recon tools — all lightweight
RUN CGO_ENABLED=0 go install -v github.com/lc/gau/v2/cmd/gau@latest && \
    go install -v github.com/d3mondev/puredns/v2@latest && \
    go install -v github.com/tomnomnom/gf@latest && \
    go install -v github.com/tomnomnom/anew@latest && \
    go install -v github.com/tomnomnom/qsreplace@latest && \
    go install -v github.com/tomnomnom/unfurl@latest && \
    go install -v github.com/tomnomnom/waybackurls@latest && \
    go install -v github.com/hakluke/hakrawler@latest

# User's Go recon tools — each with fallback so one failure doesn't block others
RUN CGO_ENABLED=0 go install -v github.com/tomnomnom/assetfinder@latest || true
RUN CGO_ENABLED=0 go install -v github.com/jaeles-project/gospider@latest || true
RUN CGO_ENABLED=0 go install -v github.com/BishopFox/jsluice/cmd/jsluice@latest || true
RUN CGO_ENABLED=0 go install -v github.com/haccer/subjack@latest || true
RUN CGO_ENABLED=0 go install -v github.com/projectdiscovery/urlfinder/cmd/urlfinder@latest || true
RUN CGO_ENABLED=0 go install -v github.com/gwen001/github-subdomains@latest || true
RUN CGO_ENABLED=0 go install -v github.com/edoardottt/csprecon/cmd/csprecon@latest || true
RUN CGO_ENABLED=0 go install -v github.com/projectdiscovery/pdtm/cmd/pdtm@latest || true

# shef — Shodan/Censys/Fofa facet search
RUN CGO_ENABLED=0 go install -v github.com/1hehaq/shef@latest || true

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM alpine:3.21

RUN apk add --no-cache \
    ca-certificates \
    curl \
    jq \
    git \
    python3 \
    py3-pip \
    bind-tools \
    nmap \
    libpcap \
    build-base \
    && rm -rf /var/cache/apk/*

# Build massdns from source (not in Alpine repos, needed by puredns)
RUN git clone --depth 1 https://github.com/blechschmidt/massdns /tmp/massdns && \
    cd /tmp/massdns && make && cp bin/massdns /usr/local/bin/ && \
    rm -rf /tmp/massdns

# Copy binary-release PD tools
COPY --from=builder /pd-bin/ /usr/local/bin/
# Copy go-installed tools
COPY --from=builder /go/bin/ /usr/local/bin/

# Download nuclei templates on build so agents don't wait at runtime
RUN nuclei -update-templates 2>/dev/null || true

# Install gf patterns (community XSS/SSRF/SQLi/LFI patterns)
RUN mkdir -p /root/.gf && \
    git clone --depth 1 https://github.com/1ndianl33t/Gf-Patterns /tmp/gf-patterns && \
    cp /tmp/gf-patterns/*.json /root/.gf/ && \
    rm -rf /tmp/gf-patterns

WORKDIR /work
CMD ["sleep", "infinity"]
