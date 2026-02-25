# API Testing

## API Reconnaissance

API reconnaissance involves understanding the API's structure, endpoints, authentication mechanisms, and potential vulnerabilities. Key steps include:

-   **Documentation Review:** Analyzing official API documentation, if available.
-   **Traffic Interception:** Using proxies (e.g., Burp Suite, OWASP ZAP) to intercept and analyze API requests and responses.
-   **Endpoint Discovery:** Identifying hidden or undocumented API endpoints through fuzzing, directory brute-forcing, or analyzing client-side code.
-   **Parameter Analysis:** Understanding the purpose and expected values of API parameters.

## BOLA/IDOR

-   **Broken Object Level Authorization (BOLA) / Insecure Direct Object Reference (IDOR):** These vulnerabilities occur when an application uses user-supplied input to access objects directly, but fails to properly validate if the requesting user is authorized to access that object. Attackers can manipulate object IDs to access or modify data they shouldn't have access to.

## Rate Limit Bypass

Rate limiting is a security measure to prevent abuse by restricting the number of requests a user can make within a certain timeframe. Bypass techniques include:

-   **IP Rotation:** Using multiple IP addresses to distribute requests.
-   **Adding Null Bytes/Whitespace:** Modifying request parameters with null bytes or extra whitespace to bypass simple filters.
-   **Changing HTTP Headers:** Manipulating headers like `X-Forwarded-For` to appear as different users.
-   **Parameter Tampering:** Modifying parameters to bypass rate limit checks.

## GraphQL

GraphQL APIs can introduce unique security considerations:

-   **Introspection:** GraphQL's introspection feature can reveal the entire API schema, which can be useful for attackers. Disabling introspection in production environments is often recommended.
-   **Excessive Data Exposure:** Over-fetching or under-fetching data can lead to exposure of sensitive information.
-   **Batching Attacks:** Combining multiple queries into a single request can bypass rate limits or lead to denial of service.
-   **Alias Overuse:** Using aliases to query the same field multiple times can also lead to performance issues or information disclosure.
