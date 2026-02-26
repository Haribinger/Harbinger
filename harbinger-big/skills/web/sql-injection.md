# SQL Injection

## SQLi Detection

SQL Injection (SQLi) is a web security vulnerability that allows an attacker to interfere with the queries that an application makes to its database. Detection methods include:

-   **Manual Testing:** Injecting SQL metacharacters (e.g., `'`, `"`, `--`, `;`) into input fields and observing application responses.
-   **Automated Scanners:** Using tools like SQLMap, Burp Suite, or OWASP ZAP to identify potential SQLi vulnerabilities.
-   **Error-Based:** Triggering database errors to reveal information about the database structure.
-   **Time-Based Blind:** Injecting time-delay functions to infer information based on response times.

## SQLMap Usage

SQLMap is an open-source penetration testing tool that automates the process of detecting and exploiting SQL injection flaws.

```bash
sqlmap -u "http://example.com/vulnerable?id=1" --dbs
sqlmap -u "http://example.com/vulnerable?id=1" -D database_name --tables
sqlmap -u "http://example.com/vulnerable?id=1" -D database_name -T table_name --dump
```

## Blind, Time, Error, Union-Based SQLi

-   **Blind SQLi:** No data is directly retrieved from the database. The attacker infers the database structure by asking true/false questions and observing the application's behavior or response times.
-   **Time-Based Blind SQLi:** A type of blind SQLi where the attacker relies on the time it takes for the database to respond to infer information.
-   **Error-Based SQLi:** The attacker relies on error messages thrown by the database server to obtain information about the database structure.
-   **Union-Based SQLi:** Uses the `UNION` SQL operator to combine the results of two or more `SELECT` statements into a single result, allowing the attacker to retrieve data from other tables.

## WAF Bypass

Web Application Firewalls (WAFs) can detect and block SQLi attempts. Bypass techniques include:

-   **Obfuscation:** Using comments, encoding, or alternative syntax to hide malicious payloads.
-   **HTTP Parameter Pollution (HPP):** Sending multiple parameters with the same name to confuse the WAF or application.
-   **Case Variation:** Changing the case of SQL keywords (e.g., `SeLeCt` instead of `SELECT`).
-   **Whitespace Alternatives:** Using alternative characters for whitespace (e.g., `/**/` instead of space).
