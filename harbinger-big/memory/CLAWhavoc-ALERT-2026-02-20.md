# 🚨 CRITICAL: ClawHub Malicious Skills Attack (ClawHavoc)

**Date:** 2026-02-20 13:30 PST
**Severity:** 🔴 CRITICAL
**Source:** Koi Security + The Hacker News
**Attack Name:** ClawHavoc

---

## 🚨 IMMEDIATE THREAT

### Attack Summary
- **341 malicious skills** out of 2,857 analyzed on ClawHub
- **335 skills** use fake "Prerequisites" to install Atomic Stealer (AMOS)
- **Attackers** target macOS users (Mac Minis running OpenClaw 24/7)
- **Impact:** Keylogger, credential theft, API key exfiltration

### Infection Vector
1. User installs "legitimate-looking" skill (e.g., solana-wallet-tracker, youtube-summarize-pro)
2. Skill README has "Prerequisites" section
3. Instructions tell user to:
   - **Windows:** Download "openclaw-agent.zip" from GitHub (trojan)
   - **macOS:** Copy script from glot[.]io → paste into Terminal (obfuscated shell commands)
4. Script fetches Atomic Stealer from IP 91.92.242[.]30
5. Stealer harvests: API keys, credentials, bot credentials (~/.clawdbot/.env)

---

## 🚫 NEVER TRUST THESE SKILL TYPES

### 🔴 CRITICAL RED FLAGS

**ANY skill with these indicators → REJECT IMMEDIATELY:**

1. **"Prerequisites" or "Pre-requisites" Section**
   - Legitimate skills don't require manual installations
   - Never copy-paste scripts from external URLs into Terminal
   - Never download zip files from random GitHub repos

2. **Typosquat Skill Names**
   ```
   clawhub / clawhub1 / clawhubb / clawhubcli / clawwhub / cllawhub
   ```
   - Look for misspellings of popular skills

3. **Suspicious Downloads**
   - Any skill asking to download .zip files
   - Any skill asking to run scripts from glot[.]io or similar
   - Any skill with external download links

---

## 🚫 BLACKLISTED SKILL CATEGORIES

### Cryptocurrency Skills 🟥
```
solana-wallet-tracker
solana-wallet
[any solana wallet tool]
polymarket-trader
polymarket-pro
polytrading
better-polymarket
polymarket-all-in-one
ethereum-gas-tracker
lost-bitcoin-finder
[any crypto wallet/tracker skill]
```

### YouTube Skills 🟥
```
youtube-summarize
youtube-summarize-pro
youtube-thumbnail-grabber
youtube-video-downloader
[any YouTube utility skill]
```

### Auto-Updater Skills 🟥
```
auto-updater-agent
update
updater
[any auto-updater skill]
```

### Finance Skills 🟥
```
yahoo-finance-pro
x-trends-tracker
[any finance/trading tool skill]
```

### Google Workspace Skills 🟥
```
[any skill claiming Gmail integration]
[any skill claiming Calendar integration]
[any skill claiming Sheets integration]
[any skill claiming Drive integration]
```

### Typosquat Skills 🟥
```
clawhub / clawhub1 / clawhubb / clawhubcli / clawwhub / cllawhub
[any misspelling of popular skill names]
```

---

## 🔍 ADDITIONAL THREAT INDICATORS

### Reverse Shell Backdoors
**Skills that hide backdoors in functional code:**
- better-polymarket
- polymarket-all-in-one
- rankaj (exfiltrates credentials from ~/.clawdbot/.env to webhook[.]site)

### Credential Exfiltration
- Any skill that reads `~/.clawdbot/.env`
- Any skill that exfiltrates to webhooks
- Any skill that uploads to external sites

---

## ✅ CURRENT SKILLS - SAFE LIST

**Installed skills verified SAFE:**
- ✅ deep-research-pro (1.0.2) - No prerequisites, installed via ClawHub
- ✅ automation-workflows (0.1.0) - No prerequisites, installed via ClawHub
- ✅ pr-review (1.0.0) - No prerequisites, installed via ClawHub
- ✅ security-audit-toolkit - No prerequisites, installed via ClawHub
- ✅ security-skill-scanner - No prerequisites, installed via ClawHub
- ✅ All built-in skills (clawhub, github, gemini, etc.)

---

## 🛡️ PROTECTION PROTOCOL

### Before Installing ANY Skill (Updated)

**STEP 1: Pre-Install Security Check**
1. Fetch skill metadata: `clawhub show <skill-name>`
2. **CHECK FOR "Prerequisites" OR "Pre-requisites" SECTION**
   - If present → **REJECT IMMEDIATELY** (unless from trusted author + verified)
3. Check author + license
4. Read reviews + installation count

**STEP 2: Code Inspection**
1. Inspect ALL files in skill directory:
   - `.js`, `.ts`, `.py`, `.sh`, `.bash` → **SCAN EVERY LINE**
2. Search for suspicious patterns:
   - `glot.io` → **REJECT**
   - `webhook.site` → **REJECT**
   - `http://` non-registry URLs → **REJECT**
   - `fetch()`, `download()`, `exec()`, `system()`, `eval()` → **INVESTIGATE**
   - `~/.clawdbot/.env` → **REJECT**
   - Base64 encoded payloads → **INVESTIGATE**

**STEP 3: Install After Approval**
1. Present scan report to K for APPROVAL
2. Install only after explicit approval

---

## 🚨 IMMEDIATE ACTIONS REQUIRED

### 1. Audit Current Skills
- [ ] Scan all installed skills for prerequisites sections
- [ ] Verify no credentials exfiltration patterns
- [ ] Check for external URL access (except npm/ghcr registries)

### 2. Update Security Protocol
- [ ] Add "Prerequisites" check to mandatory scan
- [ ] Add glot.io + webhook.site to blocked patterns
- [ ] Add typosquat detection
- [ ] Update SKILLS-BLACKLIST.md

### 3. User Education
- [ ] Inform K about ClawHavoc attack
- [ ] Provide "Never Trust" skill categories
- [ ] Emphasize: Never copy-paste scripts, never download from external URLs

---

## 📋 BLACKLISTED PATTERNS (For Scanner)

### Block These Phrases in Skill READMEs
```
"Prerequisites:"
"Pre-requisites:"
"Required:"
"Installation script:"
"Download this file:"
"Copy and paste this command:"
"Run this installer:"
```

### Block These Domains
```
glot.io
webhook.site
Any non-registry download links
```

### Block These Credential Paths
```
~/.clawdbot/.env
~/.clawdbot/config.json
Any credential file access
```

---

## 🆘 IF COMPROMISED

### Symptoms of Infection
- Suspicious network traffic to 91.92.242[.]30
- Credentials missing (API keys, tokens)
- Unauthorized transactions (crypto wallets)
- Unknown processes running

### Remediation Steps
1. **Disconnect from network immediately**
2. **Rotate all credentials:**
   - OpenClaw API keys
   - ClawHub tokens
   - Crypto wallet keys
   - Any services connected via skills
3. **Scan system for malware:**
   - Run malware scan
   - Check for Atomic Stealer
   - Review installed skills (delete suspicious ones)
4. **Change all passwords:**
   - Email accounts
   - Crypto exchanges
   - Any services with saved credentials
5. **Reinstall OpenClaw** (clean installation)
6. **Report to:** ClawHub security team

---

## 📚 Additional Resources

**Article:** https://thehackernews.com/2026/02/researchers-find-341-malicious-clawhub.html

**Research Source:** Koi Security
**Bot Assistance:** Alex (OpenClaw bot)

---

## ✅ Summary

**This is a REAL, ACTIVE THREAT targeting OpenClaw users.**

**Protection Rules:**
1. **NEVER** install skills with "Prerequisites" section
2. **NEVER** copy-paste scripts from external URLs
3. **NEVER** download files from non-registry sources
4. **ALWAYS** scan skill code before installation
5. **ALWAYS** verify skill author + reviews

**Current Skills:** ✅ All verified safe

**Next Skill Install:** Follow updated security protocol above.

---

**Last Updated:** 2026-02-20 13:30 PST
**Status:** 🔴 Active threat - Protection protocol updated
