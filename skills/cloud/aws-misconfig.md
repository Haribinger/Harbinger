# AWS Misconfigurations

## S3 Enumeration

Amazon S3 (Simple Storage Service) buckets can often be misconfigured, leading to public exposure of sensitive data. Enumeration techniques include:

-   **Brute-forcing bucket names:** Guessing common bucket naming conventions.
-   **AWS CLI:** Using `aws s3 ls` to list buckets if credentials allow.
-   **Publicly available tools:** Tools like `s3scanner` or `CloudBerry Explorer` can help identify open buckets.

## IAM Escalation

AWS Identity and Access Management (IAM) misconfigurations can lead to privilege escalation. Common scenarios include:

-   **Wildcard permissions:** Policies with `*` for actions or resources.
-   **Confused deputy:** A service or user with excessive permissions that can be tricked into performing actions on behalf of an attacker.
-   **Role assumption:** Exploiting trust policies that allow unauthorized entities to assume roles.

## EC2 Metadata

EC2 instance metadata service (IMDS) can be a source of sensitive information if not properly secured. Attackers can leverage SSRF vulnerabilities to access IMDS and retrieve:

-   **Temporary credentials:** IAM role credentials that can be used to access other AWS services.
-   **Instance details:** Public/private IPs, hostname, security groups.
-   **User data:** Scripts or configuration data passed to the instance at launch.

## Lambda Injection

AWS Lambda functions can be vulnerable to injection attacks if input is not properly sanitized. This can lead to:

-   **Command injection:** Executing arbitrary commands on the underlying Lambda execution environment.
-   **Code injection:** Injecting malicious code into the Lambda function itself.
-   **Environment variable exposure:** Accessing sensitive information stored in environment variables.
