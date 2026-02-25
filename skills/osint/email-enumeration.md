# Email Enumeration

## theHarvester

`theHarvester` is a simple, yet effective tool designed to gather open-source intelligence (OSINT) from various public sources. It can be used to collect emails, subdomains, hosts, employee names, open ports, and banners from different public sources like search engines and PGP key servers.

```bash
theharvester -d example.com -l 500 -b google,linkedin
```

## Breach Checking

Checking for email addresses in known data breaches can reveal compromised credentials or other sensitive information. Tools and services for breach checking include:

-   **Have I Been Pwned (HIBP):** A website that allows users to check if their email address or phone number has been compromised in a data breach.
-   **DeHashed:** A search engine for compromised credentials.
-   **Hunter.io:** Offers an email verifier and a bulk email verifier to check if email addresses are publicly available or have been part of breaches.

## Verification

Email verification ensures that an email address is valid and deliverable without actually sending an email. This can be useful for reducing bounce rates and improving the accuracy of OSINT. Methods include:

-   **SMTP Verification:** Connecting to the mail server and simulating an email delivery to check if the address exists.
-   **DNS Records:** Checking MX (Mail Exchange) records to identify the mail servers responsible for a domain.
-   **Third-party services:** Utilizing online email verification services that perform various checks to determine email validity.
