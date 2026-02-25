# syntax=docker/dockerfile:1.7

# Stage 1: Base image with Python and system dependencies
FROM python:3.11-slim AS base

# Environment configuration
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    UV_SYSTEM_PYTHON=1 \
    UV_LINK_MODE=copy \
    UV_HTTP_TIMEOUT=120 \
    HEXSTRIKE_HOST=0.0.0.0 \
    HEXSTRIKE_PORT=8888 \
    DEBIAN_FRONTEND=noninteractive

# Install essential system tools and Chrome dependencies
RUN set -ex; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        # Chrome dependencies
        ca-certificates \
        curl \
        wget \
        gnupg \
        unzip \
        xvfb \
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libatspi2.0-0 \
        libc6 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libexpat1 \
        libgbm1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnss3 \
        libnspr4 \
        libu2f-udev \
        libx11-6 \
        libxau6 \
        libxcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxkbcommon0 \
        libxrandr2 \
        libxrender1 \
        libxshmfence1 \
        libxtst6 \
        lsb-release \
        xdg-utils \
        # Build tools
        build-essential \
        libpcap-dev \
        git \
        # Clean up
        && rm -rf /var/lib/apt/lists/*

# Stage 2: Security tools builder
FROM base AS tools-builder

# Install masscan (port scanner)
RUN set -ex; \
    git clone --depth 1 https://github.com/robertdavidgraham/masscan.git /tmp/masscan; \
    make -C /tmp/masscan -j"$(nproc)"; \
    make -C /tmp/masscan install; \
    rm -rf /tmp/masscan

# Install dnsenum (DNS enumeration)
RUN set -ex; \
    git clone --depth 1 https://github.com/fwaeytens/dnsenum /opt/dnsenum; \
    ln -sf /opt/dnsenum/dnsenum.pl /usr/local/bin/dnsenum; \
    chmod +x /opt/dnsenum/dnsenum.pl

# Install medusa (parallel network login auditor)
RUN set -ex; \
    # Try apt first, fallback to source build
    if ! apt-get update && apt-get install -y --no-install-recommends medusa; then \
      apt-get update; \
      apt-get install -y --no-install-recommends autoconf automake libtool libssl-dev libssh-dev libpq-dev; \
      git clone --depth 1 https://github.com/jmk-foofus/medusa /tmp/medusa; \
      cd /tmp/medusa; \
      ./configure; \
      make -j"$(nproc)"; \
      make install; \
      rm -rf /tmp/medusa; \
    fi; \
    rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package installer) - required before patator
RUN pip install --no-cache-dir uv

# Install patator (multi-purpose brute-forcer)
RUN set -ex; \
    git clone --depth 1 https://github.com/lanjelot/patator /opt/patator; \
    # Find the main executable
    entry=$(find /opt/patator -type f \( -name 'patator.py' -o -name 'patator' \) | head -n1); \
    if [ -z "$entry" ]; then \
        echo "ERROR: patator entry not found" >&2; \
        ls -la /opt/patator >&2; \
        exit 1; \
    fi; \
    ln -sf "$entry" /usr/local/bin/patator; \
    chmod +x "$entry"; \
    # Install Python dependencies
    if [ -f /opt/patator/requirements.txt ]; then \
        uv pip install --system --no-cache -r /opt/patator/requirements.txt; \
    else \
        uv pip install --system --no-cache paramiko requests pysmb PySocks; \
    fi

# Install Google Chrome (stable version)
RUN set -ex; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
        amd64) chrome_arch="amd64" ;; \
        arm64) chrome_arch="arm64" ;; \
        *) echo "Unsupported architecture for Chrome: $arch"; exit 1 ;; \
    esac; \
    wget -O /tmp/chrome.deb "https://dl.google.com/linux/direct/google-chrome-stable_current_${chrome_arch}.deb"; \
    apt-get update; \
    apt-get install -y --no-install-recommends /tmp/chrome.deb; \
    rm -f /tmp/chrome.deb; \
    rm -rf /var/lib/apt/lists/*

# Stage 3: Python dependencies
FROM tools-builder AS python-deps

WORKDIR /app

# Copy and install Python dependencies
COPY requirements.txt .
RUN set -ex; \
    uv pip install --system --no-cache -r requirements.txt

# Stage 4: Additional security tools
FROM python-deps AS security-tools

# Install additional system packages for security tools
RUN set -ex; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        # Build dependencies
        pkg-config \
        python3-dev \
        libkrb5-dev \
        libldap2-dev \
        libsasl2-dev \
        libcurl4-openssl-dev \
        libxml2-dev \
        libxslt1-dev \
        libzip-dev \
        libffi-dev \
        libssl-dev \
        zlib1g-dev \
        # dnsenum dependencies
        libnet-ip-perl \
        libnet-dns-perl \
        libio-socket-inet6-perl \
        libnet-dns-sec-perl \
        libxml-writer-perl \
        libstring-random-perl \
        # Common tools
        ldap-utils \
        smbclient \
        perl \
        cpanminus \
        whois \
        # Network/WEB tools
        nmap \
        dirb \
        hydra \
        john \
        hashcat \
        # Binary analysis
        gdb \
        binwalk \
        foremost \
        steghide \
        binutils \
        libimage-exiftool-perl \
        # Ruby for additional tools
        ruby-full \
        ruby-dev \
        && rm -rf /var/lib/apt/lists/*

# Install nikto (web scanner)
RUN set -ex; \
    git clone --depth 1 https://github.com/sullo/nikto /opt/nikto; \
    ln -sf /opt/nikto/program/nikto.pl /usr/local/bin/nikto; \
    chmod +x /opt/nikto/program/nikto.pl; \
    cpanm --notest --quiet IO::Socket::SSL Net::SSLeay LWP::UserAgent HTTP::Request URI Encode || true

# Install radare2 (reverse engineering framework)
RUN set -ex; \
    git clone --depth 1 https://github.com/radareorg/radare2 /tmp/radare2; \
    /tmp/radare2/sys/install.sh; \
    rm -rf /tmp/radare2

# Install Go programming language
RUN set -ex; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
        amd64) go_arch="amd64" ;; \
        arm64) go_arch="arm64" ;; \
        *) echo "Unsupported architecture for Go: $arch"; exit 1 ;; \
    esac; \
    # Get latest Go version
    go_version=$(curl -fsSL https://go.dev/VERSION?m=text | head -n1 || echo "go1.22.12"); \
    curl -fsSL -o /tmp/go.tgz "https://go.dev/dl/${go_version}.linux-${go_arch}.tar.gz"; \
    rm -rf /usr/local/go; \
    tar -C /usr/local -xzf /tmp/go.tgz; \
    rm -f /tmp/go.tgz; \
    /usr/local/go/bin/go version

# Install Java for Ghidra
RUN set -ex; \
    apt-get update; \
    if ! apt-get install -y --no-install-recommends openjdk-21-jre-headless; then \
        arch="$(dpkg --print-architecture)"; \
        case "$arch" in \
            amd64) java_arch="x64" ;; \
            arm64) java_arch="aarch64" ;; \
            *) echo "Unsupported architecture for Java fallback: $arch"; exit 1 ;; \
        esac; \
        curl -fsSL -o /tmp/temurin-jre.tgz "https://api.adoptium.net/v3/binary/latest/21/ga/linux/${java_arch}/jre"; \
        mkdir -p /opt/jdk; \
        tar -xzf /tmp/temurin-jre.tgz -C /opt/jdk; \
        rm -f /tmp/temurin-jre.tgz; \
        jre_dir=$(find /opt/jdk -maxdepth 1 -type d -name "jdk-21*" | head -n1); \
        if [ -z "$jre_dir" ]; then \
            echo "Temurin JRE extraction failed"; \
            exit 1; \
        fi; \
        ln -sf "$jre_dir/bin/java" /usr/local/bin/java; \
    fi; \
    # Install ophcrack (optional)
    apt-get install -y --no-install-recommends ophcrack || true; \
    rm -rf /var/lib/apt/lists/*

# Set Go environment
ENV GOPATH=/go \
    GOBIN=/go/bin \
    PATH=/usr/local/go/bin:/go/bin:$PATH

# Install Go-based security tools
RUN set -ex; \
    tools=" \
        github.com/OJ/gobuster/v3@latest \
        github.com/ffuf/ffuf@latest \
        github.com/projectdiscovery/httpx/cmd/httpx@latest \
        github.com/projectdiscovery/katana/cmd/katana@latest \
        github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest \
        github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest \
        github.com/hahwul/dalfox/v2@latest \
    "; \
    for tool in $tools; do \
        go install "$tool" || echo "Warning: Failed to install $tool"; \
    done

# Install amass if not available
RUN set -ex; \
    if ! command -v amass >/dev/null 2>&1; then \
        go install github.com/owasp-amass/amass/v4/cmd/amass@latest; \
    fi

# Install RustScan (fast port scanner)
RUN set -ex; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
        amd64) rs_deb_pattern='rustscan_.*_amd64\.deb'; rs_tgz_pattern='x86_64-unknown-linux-gnu\.tar\.gz' ;; \
        arm64) rs_deb_pattern='rustscan_.*_arm64\.deb'; rs_tgz_pattern='aarch64-unknown-linux-gnu\.tar\.gz' ;; \
        *) echo "Unsupported architecture for rustscan: $arch"; exit 0 ;; \
    esac; \
    # Get latest release info
    rs_api_json=$(curl -fsSL https://api.github.com/repos/RustScan/RustScan/releases/latest); \
    # Try .deb first
    rs_url=$(echo "$rs_api_json" | grep -Eo 'https://[^"]+' | grep -E "$rs_deb_pattern" | head -n1); \
    if [ -n "$rs_url" ]; then \
        wget -O /tmp/rustscan.deb "$rs_url"; \
        apt-get update; \
        apt-get install -y --no-install-recommends /tmp/rustscan.deb || true; \
        rm -f /tmp/rustscan.deb; \
    else \
        # Fallback to .tar.gz
        rs_tgz_url=$(echo "$rs_api_json" | grep -Eo 'https://[^"]+' | grep -E "$rs_tgz_pattern" | head -n1); \
        if [ -n "$rs_tgz_url" ]; then \
            wget -O /tmp/rustscan.tgz "$rs_tgz_url"; \
            mkdir -p /tmp/rustscan; \
            tar -xzf /tmp/rustscan.tgz -C /tmp/rustscan; \
            bin_path=$(find /tmp/rustscan -type f -name 'rustscan' | head -n1); \
            if [ -n "$bin_path" ]; then \
                install -m 0755 "$bin_path" /usr/local/bin/rustscan; \
            fi; \
            rm -rf /tmp/rustscan /tmp/rustscan.tgz; \
        else \
            echo "RustScan asset not found for architecture: $arch"; \
        fi; \
    fi; \
    rm -rf /var/lib/apt/lists/*

# Install Feroxbuster (content discovery tool)
RUN set -ex; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
        amd64) ferox_pattern='x86_64.*linux.*\.tar\.gz' ;; \
        arm64) ferox_pattern='aarch64.*linux.*\.tar\.gz' ;; \
        *) echo "Unsupported architecture for feroxbuster: $arch"; exit 0 ;; \
    esac; \
    ferox_api_json=$(curl -fsSL https://api.github.com/repos/epi052/feroxbuster/releases/latest); \
    ferox_url=$(echo "$ferox_api_json" | grep -Eo 'https://[^"]+' | grep -E "$ferox_pattern" | head -n1); \
    if [ -n "$ferox_url" ]; then \
        wget -O /tmp/ferox.tgz "$ferox_url"; \
        mkdir -p /tmp/ferox; \
        tar -xzf /tmp/ferox.tgz -C /tmp/ferox; \
        bin_path=$(find /tmp/ferox -type f -name 'feroxbuster' | head -n1); \
        if [ -n "$bin_path" ]; then \
            install -m 0755 "$bin_path" /usr/local/bin/feroxbuster; \
        fi; \
        rm -rf /tmp/ferox /tmp/ferox.tgz; \
    else \
        echo "Feroxbuster asset not found for architecture: $arch"; \
    fi

# Install Python-based security tools
RUN set -ex; \
    uv pip install --system --no-cache \
        fierce \
        dirsearch \
        sqlmap \
        arjun \
        git+https://github.com/devanshbatham/ParamSpider.git \
        wafw00f \
        theHarvester \
        git+https://github.com/Pennyw0rth/NetExec.git \
        scoutsuite \
        prowler \
        kube-hunter \
        volatility3

# Install AutoRecon in isolated virtual environment
RUN set -ex; \
    python -m venv /opt/autorecon-venv; \
    /opt/autorecon-venv/bin/pip install --no-cache-dir --upgrade pip setuptools wheel; \
    /opt/autorecon-venv/bin/pip install --no-cache-dir git+https://github.com/SecureAuthCorp/impacket@impacket_0_10_0; \
    /opt/autorecon-venv/bin/pip install --no-cache-dir git+https://github.com/Tib3rius/AutoRecon.git; \
    ln -sf /opt/autorecon-venv/bin/autorecon /usr/local/bin/autorecon

# Install enum4linux-ng (SMB enumeration)
# Install enum4linux-ng (SMB enumeration)
RUN set -ex; \
    git clone --depth 1 https://github.com/cddmp/enum4linux-ng /opt/enum4linux-ng; \
    if [ -f /opt/enum4linux-ng/requirements.txt ]; then \
        uv pip install --system --no-cache -r /opt/enum4linux-ng/requirements.txt; \
    else \
        uv pip install --system --no-cache pyyaml ldap3 impacket; \
    fi; \
    # Create wrapper script - fixed heredoc syntax
    echo '#!/bin/sh' > /usr/local/bin/enum4linux-ng; \
    echo 'exec /usr/bin/env python3 /opt/enum4linux-ng/enum4linux-ng.py "$@"' >> /usr/local/bin/enum4linux-ng; \
    chmod +x /usr/local/bin/enum4linux-ng 

# Install Ruby tools
RUN set -ex; \
    gem install --no-document wpscan evil-winrm

# Install Trivy (container vulnerability scanner)
RUN set -ex; \
    install -m 0755 -d /usr/share/keyrings; \
    curl -fsSL https://aquasecurity.github.io/trivy-repo/deb/public.key | gpg --dearmor -o /usr/share/keyrings/trivy.gpg; \
    echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb generic main" > /etc/apt/sources.list.d/trivy.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends trivy; \
    rm -rf /var/lib/apt/lists/*

# Install kube-bench (Kubernetes security benchmark)
RUN set -ex; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
        amd64) kb_pattern='linux_amd64\.tar\.gz' ;; \
        arm64) kb_pattern='linux_arm64\.tar\.gz' ;; \
        *) echo "Unsupported architecture for kube-bench: $arch"; exit 0 ;; \
    esac; \
    kb_api_json=$(curl -fsSL https://api.github.com/repos/aquasecurity/kube-bench/releases/latest); \
    kb_url=$(echo "$kb_api_json" | grep -Eo 'https://[^"]+' | grep -E "$kb_pattern" | head -n1); \
    if [ -n "$kb_url" ]; then \
        wget -O /tmp/kb.tgz "$kb_url"; \
        mkdir -p /tmp/kb; \
        tar -xzf /tmp/kb.tgz -C /tmp/kb; \
        bin_path=$(find /tmp/kb -type f -name 'kube-bench' | head -n1); \
        if [ -n "$bin_path" ]; then \
            install -m 0755 "$bin_path" /usr/local/bin/kube-bench; \
        fi; \
        rm -rf /tmp/kb /tmp/kb.tgz; \
    else \
        echo "kube-bench asset not found for architecture: $arch"; \
    fi

# Install docker-bench-security
# Install docker-bench-security
RUN set -ex; \
    git clone --depth 1 https://github.com/docker/docker-bench-security.git /opt/docker-bench-security; \
    # Create wrapper script - fixed heredoc syntax
    echo '#!/bin/sh' > /usr/local/bin/docker-bench-security; \
    echo 'exec /bin/sh /opt/docker-bench-security/docker-bench-security.sh "$@"' >> /usr/local/bin/docker-bench-security; \
    chmod +x /usr/local/bin/docker-bench-security
# Install checksec (binary security checker)
RUN set -ex; \
    curl -fsSL https://raw.githubusercontent.com/slimm609/checksec.sh/master/checksec -o /usr/local/bin/checksec; \
    chmod +x /usr/local/bin/checksec

# Install Responder (LLMNR/NBT-NS/mDNS poisoner)
# Install Responder (LLMNR/NBT-NS/mDNS poisoner)
RUN set -ex; \
    git clone --depth 1 https://github.com/lgandx/Responder.git /opt/Responder; \
    # Create wrapper script - fixed heredoc syntax
    echo '#!/bin/sh' > /usr/local/bin/responder; \
    echo 'exec /usr/bin/env python3 /opt/Responder/Responder.py "$@"' >> /usr/local/bin/responder; \
    chmod +x /usr/local/bin/responder

# Install hash-identifier
# Install hash-identifier
RUN set -ex; \
    git clone --depth 1 https://github.com/blackploit/hash-identifier.git /opt/hash-identifier; \
    chmod +x /opt/hash-identifier/hash-id.py; \
    # Create wrapper script - fixed heredoc syntax
    echo '#!/bin/sh' > /usr/local/bin/hash-identifier; \
    echo 'exec /usr/bin/env python3 /opt/hash-identifier/hash-id.py "$@"' >> /usr/local/bin/hash-identifier; \
    chmod +x /usr/local/bin/hash-identifier
# Install Ghidra (reverse engineering framework)
RUN set -ex; \
    ghidra_url=$(curl -fsSL https://api.github.com/repos/NationalSecurityAgency/ghidra/releases/latest | grep browser_download_url | grep PUBLIC | grep -i zip | cut -d '"' -f4 | head -n1); \
    if [ -n "$ghidra_url" ]; then \
        wget -O /tmp/ghidra.zip "$ghidra_url"; \
        mkdir -p /opt/ghidra; \
        unzip -q /tmp/ghidra.zip -d /opt/ghidra; \
        rm -f /tmp/ghidra.zip; \
        ghidra_dir=$(find /opt/ghidra -maxdepth 1 -type d -name "ghidra_*" | head -n1); \
        if [ -n "$ghidra_dir" ]; then \
            ln -sf "$ghidra_dir/ghidraRun" /usr/local/bin/ghidra; \
            ln -sf "$ghidra_dir/support/analyzeHeadless" /usr/local/bin/analyzeHeadless; \
        fi; \
    else \
        echo "Warning: Failed to resolve Ghidra release URL"; \
    fi

# Pre-download nuclei templates (optional)
RUN nuclei -update-templates || true

# Stage 5: Final image
FROM security-tools AS final

WORKDIR /app

# Copy application source code
COPY . .

# Expose API port
EXPOSE 8888

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${HEXSTRIKE_PORT}/health" || exit 1

# Runtime configuration
ENV DEBUG_MODE=0

# Default command
CMD ["uv", "run", "--", "python", "-u", "hexstrike_server.py"]
