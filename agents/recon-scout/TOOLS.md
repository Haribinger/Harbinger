Primary: subfinder, httpx, nmap, masscan, amass, dnsx, naabu, katana, waybackurls, gau, hakrawler, gospider, shef (Shodan facets), uncover, asnmap, mapcidr, cloudlist, alterx. Each tool with usage examples.

### Usage Examples:

**subfinder**
```bash
subfinder -d example.com
```

**httpx**
```bash
cat domains.txt | httpx -silent
```

**nmap**
```bash
nmap -sV example.com
```

**masscan**
```bash
masscan -p80,443 192.168.1.0/24
```

**amass**
```bash
amass enum -d example.com
```

**dnsx**
```bash
cat subdomains.txt | dnsx -resp -json
```

**naabu**
```bash
naabu -host example.com
```

**katana**
```bash
katana -u https://example.com
```

**waybackurls**
```bash
waybackurls example.com
```

**gau**
```bash
gau example.com
```

**hakrawler**
```bash
echo "https://example.com" | hakrawler
```

**gospider**
```bash
gospider -s "https://example.com" -c 10 -d 1
```

**shef (Shodan facets)**
```bash
shef org:"Example Inc."
```

**uncover**
```bash
uncover -q "port:8080"
```

**asnmap**
```bash
asnmap -org "Example Inc."
```

**mapcidr**
```bash
mapcidr -i 192.168.1.0/24
```

**cloudlist**
```bash
cloudlist -p aws -e "us-east-1"
```

**alterx**
```bash
alterx -l subdomains.txt -silent
```
