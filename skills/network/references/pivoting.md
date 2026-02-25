# Subdomain Enumeration

## Methodology: subfinder → dnsx → httpx

This methodology outlines a common approach to subdomain enumeration, leveraging a combination of tools for comprehensive results.

1.  **Subfinder:** Used for passive subdomain discovery from various sources.
2.  **Dnsx:** For resolving discovered subdomains and filtering out non-existent ones.
3.  **Httpx:** To probe resolved subdomains for active HTTP/S services.

## Passive vs. Active Enumeration

-   **Passive:** Relies on publicly available information (e.g., search engines, DNS records, third-party services) without direct interaction with the target server.
-   **Active:** Involves direct queries to DNS servers or brute-forcing techniques, which may leave traces.

## Wordlists

Effective subdomain enumeration often relies on comprehensive wordlists. Examples include:

-   `assetnote/wordlists`
-   `SecLists/Discovery/DNS`

## Real Commands

```bash
subfinder -d example.com -o subdomains.txt
dnsx -l subdomains.txt -o resolved.txt
httpx -l resolved.txt -o live_subdomains.txt
```
