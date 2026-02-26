# TOOLS.md - Local Setup & Infrastructure Cheat Sheet

## Reconnaissance Tools

### 🌐 Shef - Shodan Facet Queries (No API Key Required) ✅

**Install:**
```bash
go install github.com/1hehaq/shef@latest
```

**Usage:**
```bash
# List all available facets
shef -list

# Query Shodan with facets (no API key needed!)
shef -q "nginx" -f country

# Find by organization
shef -q "org:Company" -f port

# Get domain info
shef -q "domain:example.com" -f product,port

# Check for vulnerabilities
shef -q "vuln:CVE-2024-xxxx" -f country,org

# By country and country code
shef -q "nginx" -f country.code

# Tech stack discovery
shef -q "http.component:React" -f country,org
```

**Key Facets:**
- `domain` - Domain names
- `org` - Organization
- `country` / `country.code` - Country
- `port` - Open ports
- `product` - Software products
- `http.title` - HTTP page title
- `http.server` - HTTP server header
- `ssl.cert.subject.cn` - SSL certificate common name
- `vuln` - Vulnerability info
- `os` - Operating system

**Primary Use:** Shodan intelligence without API key - perfect for reconnaissance

**No API Key Required:** ✅ Uses public Shodan search faceting

---

### 🔍 Scilla - Information Gathering Tool

**Install:**
```bash
go install github.com/edoardottt/scilla/cmd/scilla@latest
```

**Purpose:** DNS / Subdomain / Ports / Directories enumeration

**Usage:**
```bash
# DNS enumeration
scilla dns -target example.com

# Subdomain enumeration
scilla subdomain -target example.com
scilla subdomain -target example.com -c  # with crawler
scilla subdomain -target example.com -db  # with public databases

# Port scanning
scilla port -target example.com
scilla port -target example.com -common  # scan common ports
scilla port -target example.com -p 1-1000  # range

# Directory fuzzing
scilla dir -target https://example.com
```

**Primary Use:** Comprehensive recon tool for bug bounty hunting

---

## Command Aliases

Add to your shell (~/.zshrc or ~/.bashrc):

```bash
# Shodan intelligence (shef)
alias shef='$(go env GOPATH)/bin/shef'
alias shodan='$(go env GOPATH)/bin/shef'

# Recon tool (scilla)
alias scilla='$(go env GOPATH)/bin/scilla'
```

Setup autocompletion for shef facets:
```bash
echo -e "complete -W '\$(shef -list)' shef" >> ~/.zshrc && source ~/.zshrc
```

Reload: `source ~/.zshrc`

---

## Usage Workflow for Bug Bounty Hunting

1. **Initial Recon:** Use shef to gather intel on target
2. **Subdomain Discovery:** Use scilla to find subdomains
3. **Port Scanning:** Use scilla to enumerate open ports
4. **Directory Fuzzing:** Use scilla for hidden endpoints
5. **Vulnerability Scanning:** Use nuclei or other tools

---

## Note

**Scilla is NOT a bug bounty finder** - it's a reconnaissance/enumeration tool for:
- DNS lookups
- Subdomain discovery
- Port scanning
- Directory enumeration

For finding bug bounty programs, use manual research or check company security pages directly.