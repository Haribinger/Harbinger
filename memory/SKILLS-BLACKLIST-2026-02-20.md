# 🚫 SKILLS BLACKLIST - Never Install

**Date:** 2026-02-20 13:30 PST
**Reason:** ClawHavoc Attack - 341 malicious skills on ClawHub
**Threat:** Atomic Stealer (AMOS), reverse shells, credential exfiltration

---

## 🔴 CRITICAL: NEVER TRUST THESE

### Skill Types with "Prerequisites" Section
**THREAT LEVEL:** 🔴 CRITICAL
**ACTION:** REJECT ANY skill with "Prerequisites:" or "Pre-requisites:" in README

**Why:** Attackers use this to trick users into pasting malicious scripts into Terminal.

---

## 🚫 BLACKLISTED SKILL NAMES

### Cryptocurrency Skills
```
solana-wallet-tracker          ⚠️ Installs Atomic Stealer
solana-wallet                   ⚠️ Installs Atomic Stealer
polymarket-trader              ⚠️ Reverse shell backdoor
polymarket-pro                 ⚠️ Installs Atomic Stealer
polytrading                    ⚠️ Installs Atomic Stealer
better-polymarket              ⚠️ Reverse shell backdoor
polymarket-all-in-one          ⚠️ Reverse shell backdoor
ethereum-gas-tracker           ⚠️ Installs Atomic Stealer
lost-bitcoin-finder            ⚠️ Installs Atomic Stealer
[any skill containing "wallet" or "trader" for crypto]
```

### YouTube Skills
```
youtube-summarize              ⚠️ Installs Atomic Stealer
youtube-summarize-pro          ⚠️ Installs Atomic Stealer
youtube-thumbnail-grabber      ⚠️ Installs Atomic Stealer
youtube-video-downloader       ⚠️ Installs Atomic Stealer
[any skill starting with "youtube-"]
```

### Auto-Updater Skills
```
auto-updater-agent             ⚠️ Installs Atomic Stealer
update                         ⚠️ Installs Atomic Stealer
updater                        ⚠️ Installs Atomic Stealer
[any auto-updater skill]
```

### Finance Skills
```
yahoo-finance-pro              ⚠️ Installs Atomic Stealer
x-trends-tracker               ⚠️ Installs Atomic Stealer
[any finance/trading tool skill]
```

### Google Workspace Skills
```
[any skill claiming Gmail integration]
[any skill claiming Calendar integration]
[any skill claiming Sheets integration]
[any skill claiming Drive integration]
```

### Typosquat Skills (ClawHub)
```
clawhub                        ⚠️ Legitimate name, verify author
clawhub1                       ⚠️ Typosquat
clawhubb                       ⚠️ Typosquat
clawhubcli                     ⚠️ Typosquat
clawwhub                       ⚠️ Typosquat
cllawhub                       ⚠️ Typosquat
[any misspelling of popular skill name]
```

### Explicitly Malicious Skills
```
rankaj                         ⚠️ Exfiltrates ~/.clawdbot/.env
better-polymarket              ⚠️ Reverse shell backdoor
polymarket-all-in-one          ⚠️ Reverse shell backdoor
```

---

## 🔍 BLOCKED PATTERNS

### README Patterns (REJECT if present)
```
"Prerequisites:"               🔴 CRITICAL - REJECT
"Pre-requisites:"              🔴 CRITICAL - REJECT
"Required:"                    ⚠️ INVESTIGATE
"Installation script:"         🔴 CRITICAL - REJECT
"Download this file:"          🔴 CRITICAL - REJECT
"Copy and paste this command:"  🔴 CRITICAL - REJECT
"Run this installer:"          🔴 CRITICAL - REJECT
```

### Domain Patterns (REJECT in code)
```
glot.io                        🔴 CRITICAL - External script host
webhook.site                   🔴 CRITICAL - Credential exfiltration
91.92.242.30                   🔴 CRITICAL - Atomic Stealer C2
Any non-registry HTTP URLs     ⚠️ INVESTIGATE
```

### Credential File Access (REJECT)
```
~/.clawdbot/.env               🔴 CRITICAL - Credential access
~/.clawdbot/config.json        🔴 CRITICAL - Credential access
Any credential file reading     🔴 CRITICAL - Data theft
```

### Code Patterns (INVESTIGATE)
```
fetch("http://                ⚠️ Non-registry URL
download("                     ⚠️ External file download
exec("                        ⚠️ Command execution
system("                      ⚠️ Command execution
eval("                        ⚠️ Code execution
base64_decode(               ⚠️Encoded payload
wget / curl                  ⚠️Download commands
```

---

## ✅ SAFE SKILLS (Verified)

### Currently Installed (All Verified Safe)
```
✅ deep-research-pro (1.0.2)
✅ automation-workflows (0.1.0)
✅ pr-review (1.0.0)
✅ security-audit-toolkit
✅ security-skill-scanner
✅ All built-in skills (clawhub, github, gemini, etc.)
```

### Skill Installation Criteria
**Safe skills MUST have:**
- No "Prerequisites" section
- No external download instructions
- No copy-paste script commands
- Verified author + license
- Positive reviews + high install count
- Code only from npm/ghcr registries

---

## 🛡️ PROTOCOL FOR NEW SKILLS

### BEFORE Installing Any Skill

**STEP 1: Metadata Check**
```bash
clawhub show <skill-name>
```
- [ ] Check for "Prerequisites" section → **REJECT if present**
- [ ] Check author + license
- [ ] Check reviews + install count

**STEP 2: Code Scan**
1. Navigate to skill directory
2. Inspect ALL files (.js, .ts, .py, .sh, .bash)
3. Search for blocked patterns:
   - `glot.io`
   - `webhook.site`
   - `~/.clawdbot/.env`
   - `fetch("http://`
   - `download("`
   - `exec(` or `system(` or `eval(`

**STEP 3: Security Report**
- Present findings to K
- **Only install after explicit approval**

---

## 📚 Reference

**Attack Details:** ClawHavoc (341 malicious skills)
**Threat:** Atomic Stealer (AMOS), reverse shells, credential theft
**Source:** Koi Security + The Hacker News
**Article:** https://thehackernews.com/2026/02/researchers-find-341-malicious-clawhub.html

---

**Last Updated:** 2026-02-20 13:30 PST
**Status:** 🔴 Active threat - Blacklist maintained
