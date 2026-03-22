# harbinger/kali-tools — Exploitation + API testing tools for BREACH
#
# Exploitation: sqlmap, dalfox, ffuf, gobuster, nmap, masscan, nikto,
#               commix, wfuzz, whatweb, dirb, crlfuzz
# API testing:  arjun, jwt_tool
# Secrets:      trufflehog (binary release)

FROM kalilinux/kali-rolling

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    jq \
    git \
    python3 \
    python3-pip \
    python3-venv \
    ca-certificates \
    unzip \
    # Exploitation tools (Kali repos)
    sqlmap \
    nmap \
    masscan \
    nikto \
    gobuster \
    dirb \
    whatweb \
    wfuzz \
    commix \
    feroxbuster \
    # Build tools for Go-based installs
    golang \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Go-based tools — install individually so failures are visible
RUN go install github.com/ffuf/ffuf/v2@latest && \
    cp /root/go/bin/ffuf /usr/local/bin/

RUN go install github.com/hahwul/dalfox/v2@latest && \
    cp /root/go/bin/dalfox /usr/local/bin/

RUN go install github.com/dwisiswant0/crlfuzz/cmd/crlfuzz@latest && \
    cp /root/go/bin/crlfuzz /usr/local/bin/ || true

# trufflehog — use binary release (too large to compile in Kali's Go)
RUN curl -sSL "https://github.com/trufflesecurity/trufflehog/releases/latest/download/trufflehog_linux_amd64.tar.gz" \
    | tar xz -C /usr/local/bin trufflehog || \
    echo "trufflehog install skipped — binary not available for this arch"

# Clean up Go build cache
RUN rm -rf /root/go/pkg /root/go/src /root/.cache/go-build

# Python-based tools (--break-system-packages for Kali's system Python)
RUN pip install --no-cache-dir --break-system-packages \
    arjun \
    jwt-tool || true

# Wordlists — common + params + API paths
RUN mkdir -p /usr/share/wordlists && \
    curl -sSL -o /usr/share/wordlists/common.txt \
        https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/common.txt && \
    curl -sSL -o /usr/share/wordlists/params.txt \
        https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/burp-parameter-names.txt && \
    curl -sSL -o /usr/share/wordlists/api-endpoints.txt \
        https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/api/api-endpoints.txt || true

WORKDIR /work
CMD ["sleep", "infinity"]
