# Server-Side Request Forgery (SSRF)

## SSRF Detection

Server-Side Request Forgery (SSRF) is a web security vulnerability that allows an attacker to induce the server-side application to make HTTP requests to an arbitrary domain of the attacker's choosing. Detection methods include:

-   **URL-based input:** Checking parameters that expect a URL, hostname, or IP address.
-   **Error messages:** Observing verbose error messages that might reveal internal network details.
-   **DNS interaction:** Monitoring DNS requests from the target server to identify outbound connections.
-   **Time-based differences:** Exploiting time delays when the server attempts to connect to non-existent internal resources.

## Cloud Metadata (AWS/GCP/Azure)

SSRF can be used to access cloud provider metadata services, which often contain sensitive information such as temporary credentials, instance details, and user data.

-   **AWS:** `http://169.254.169.254/latest/meta-data/`
-   **GCP:** `http://metadata.google.internal/computeMetadata/v1/`
-   **Azure:** `http://169.254.169.254/metadata/instance?api-version=2017-08-01`

## DNS Rebinding

DNS rebinding is an attack technique that can bypass same-origin policy and WAFs by manipulating DNS resolutions. An attacker registers a domain name and configures it to resolve to two different IP addresses sequentially:

1.  **First resolution:** Resolves to the attacker's controlled server, allowing the attacker to serve malicious content (e.g., JavaScript).
2.  **Second resolution:** Resolves to an internal IP address (e.g., `127.0.0.1` or a private network IP), allowing the malicious JavaScript to make requests to internal resources that would otherwise be protected by the same-origin policy.
