---
name: cloud
description: >
  Cloud security and misconfiguration skill for Harbinger's PHANTOM agent. Covers AWS, Azure,
  and GCP auditing using Prowler, ScoutSuite, and Pacu. Includes S3 enumeration, IAM privilege
  escalation, EC2 metadata exploitation, Lambda injection, and SSRF-to-cloud-metadata chains.
  Use when auditing cloud infrastructure, hunting for cloud misconfigs, escalating via IAM, or
  accessing metadata services. Triggers on: "cloud audit", "AWS pentest", "S3 bucket enum",
  "IAM escalation", "EC2 metadata", "run phantom", "cloud misconfig", "Prowler", "ScoutSuite".
---

# Cloud Skill

PHANTOM agent skill — cloud infrastructure infiltration and misconfiguration auditing.

## Automated Cloud Audit

Run `scripts/cloud-audit.sh <aws|azure|gcp> <account_id>` for Prowler + ScoutSuite pipeline.

Results in `cloud-audit-output/<provider>/<target>/YYYYMMDD/`.

## AWS Quick Commands

```bash
# Enumerate S3 buckets (with configured creds)
aws s3 ls
aws s3 ls s3://target-bucket --no-sign-request   # public bucket check

# Check current identity
aws sts get-caller-identity

# List IAM policies attached to current user
aws iam list-attached-user-policies --user-name $(aws iam get-user --query User.UserName --output text)

# Pull EC2 instance metadata (from SSRF or inside instance)
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/

# Prowler — full AWS audit
prowler aws -M json -o audit-results/

# ScoutSuite
scout aws --report-dir scout-results/

# Pacu — AWS exploitation framework
pacu
```

## Cloud Metadata Endpoints (for SSRF chains)

| Provider | Metadata URL |
|----------|-------------|
| AWS IMDSv1 | `http://169.254.169.254/latest/meta-data/` |
| AWS IMDSv2 | Requires token: `PUT http://169.254.169.254/latest/api/token` |
| GCP | `http://metadata.google.internal/computeMetadata/v1/` (+ `Metadata-Flavor: Google`) |
| Azure | `http://169.254.169.254/metadata/instance?api-version=2019-06-01` (+ `Metadata: true`) |

## References

- **AWS misconfigurations (S3, IAM, EC2, Lambda)**: See [references/aws-misconfig.md](references/aws-misconfig.md)
