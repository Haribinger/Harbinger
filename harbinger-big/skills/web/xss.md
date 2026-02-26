# Cross-Site Scripting (XSS)

## Reflected, Stored, DOM XSS

-   **Reflected XSS:** The injected script is reflected off the web server, such as in an error message, search result, or any other response that includes some or all of the input sent by the user as part of the request.
-   **Stored XSS:** The injected script is permanently stored on the target servers, such as in a database, in a message forum, visitor log, or comment field. The victim retrieves the malicious script from the server when requesting the stored information.
-   **DOM-based XSS:** The vulnerability exists in the client-side code rather than the server-side code. The malicious payload is executed as a result of modifying the DOM environment in the victim's browser.

## Dalfox/XSStrike

-   **Dalfox:** A powerful open-source XSS scanner and parameter analyzer written in Go.
-   **XSStrike:** A comprehensive XSS scanner that can detect and exploit XSS vulnerabilities, featuring a powerful payload generator.

## Filter Bypass

Web Application Firewalls (WAFs) and input filters often attempt to prevent XSS. Bypass techniques include:

-   **Encoding:** Using HTML entities, URL encoding, or JavaScript encoding to bypass filters.
-   **Obfuscation:** Breaking up keywords or using unusual syntax to evade detection.
-   **Event Handlers:** Utilizing less common HTML event handlers (e.g., `onerror`, `onmouseover`) to trigger payloads.
-   **Null Bytes:** Inserting null bytes to confuse filters.

## Payloads

Common XSS payloads:

```html
<script>alert('XSS')</script>
<img src=x onerror=alert('XSS')>
<svg/onload=alert('XSS')>
```
