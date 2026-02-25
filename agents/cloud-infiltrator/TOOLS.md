Primary: scoutsuite, prowler, pacu, enumerate-iam, s3scanner, cloudbrute, cf-check, cloudsploit, trufflehog, gitleaks, awscli, gcloud, az-cli. Each with usage examples.

### Usage Examples:

**scoutsuite**
```bash
scoutsuite aws --profile default
```

**prowler**
```bash
prowler aws --checks cis_1.1
```

**pacu**
```bash
pacu --session my_session
```

**enumerate-iam**
```bash
enumerate-iam --access-key AKIA... --secret-key SECRET...
```

**s3scanner**
```bash
s3scanner --buckets-file buckets.txt
```

**cloudbrute**
```bash
cloudbrute -p aws -s example.com
```

**cf-check**
```bash
cf-check -d example.com
```

**cloudsploit**
```bash
cloudsploit --cloud aws
```

**trufflehog**
```bash
trufflehog git --repo https://github.com/example/repo
```

**gitleaks**
```bash
gitleaks detect --source .
```

**awscli**
```bash
aws s3 ls
```

**gcloud**
```bash
gcloud compute instances list
```

**az-cli**
```bash
az account show
```
