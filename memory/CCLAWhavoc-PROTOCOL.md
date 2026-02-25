# 🚨 CLAWhavoc Security Protocol - QUICK REFERENCE

**Date:** 2026-02-20 13:54 PST
**Status:** 🔴 ACTIVE THREAT - PROTOCOL ACTIVE

---

## 🚨 ONE-LINE SUMMARY

**NEVER install skills with "Prerequisites" section – it's the ClawHavoc attack vector for Atomic Stealer.**

---

## ✅ INSTALLED SKILLS STATUS

**All Verified Safe:** ✅
1. deep-research-pro (1.0.2)
2. automation-workflows (0.1.0)
3. pr-review (1.0.0)
4. security-audit-kit
5. security-skill-scanner
6. All built-in skills (clawhub, github, gemini, etc.)

**No infection detected.**

---

## 🔴 IMMEDIATE REJECTION RULES

### REJECT ANY SKILL WITH:

1. **"Prerequisites:" or "Pre-requisites:" in README**
   - Legitimate skills don't require manual installations
   - This is the attack vector for Atomic Stealer

2. **External download instructions**
   - "Download this file"
   - "Copy and paste this command"
   - "Run this installer"
   - Links to glot.io, webhook.site, or any non-registry URL

3. **Blacklisted skill names** (see SKILLS-BLACKLIST-2026-02-20.md)
   - Crypto: solana-wallet, polymarket-trader, ethereum-gas-tracker
   - YouTube: youtube-summarize, youtube-video-downloader
   - Auto-updaters: auto-updater-agent, update, updater
   - Typosquats: clawhub1, clawhubb, clawwhub

4. **Malicious code patterns:**
   - glot.io
   - webhook.site
   - ~/.clawdbot/.env
   - fetch("http:// (non-registry URLs)
   - download()
   - exec() or system()
   - eval()

---

## 🛡️ BEFORE INSTALLING ANY SKILL

### Step 1: Check Blacklist
```bash
cat /Users/nunu/.openclaw/workspace/SKILLS-BLACKLIST-2026-02-20.md
```

### Step 2: Check README
- [ ] Look for "Prerequisites:" → **REJECT if present**
- [ ] Look for external downloads → **REJECT if present**
- [ ] Check for suspicious domains (glot.io, webhook.site)

### Step 3: Scan Code
Search skill files for:
- glot.io **REJECT**
- webhook.site **REJECT**
- ~/.clawdbot/.env **REJECT**
- fetch(), download() **INVESTIGATE**
- exec(), system(), eval() **INVESTIGATE**

### Step 4: Get Approval
- Present scan report to K
- Only install after explicit approval

---

## 📚 Files Created

1. **CLAWhavoc-ALERT-2026-02-20.md** - Full attack details (7,060 bytes)
2. **SKILLS-BLACKLIST-2026-02-20.md** - Complete blacklist (5,515 bytes)
3. **SECURITY-ALERT-CLAWhavoc.md** - Immediate threat summary (3,250 bytes)
4. **CRITICAL-ALERT-SUMMARY.md** - Quick reference (2,946 bytes)
5. **MEMORY.md** - Updated security protocol with blacklist rules

---

## 📊 Attack Summary

- **341 malicious skills** on ClawHub
- **335 skills** with "Prerequisites" attack vector
- **Attack:** Atomic Stealer (AMOS) keylogger + credential thief
- **Theft:** API keys, wallets, ~./clawdbot/.env credentials
- **Researcher:** Koi Security (Alex bot)
- **Article:** https://thehackernews.com/2026/02/researchers-find-341-malicious-clawhub.html

---

## ⚠️ IF COMPROMISED

**Symptoms:**
- Suspicious network to 91.92.242[.]30
- Missing credentials (API keys, tokens, wallets)
- Unknown processes

**Actions:**
1. Disconnect network
2. Rotate all credentials (API keys, crypto wallets, passwords)
3. Scan system for malware
4. Delete suspicious skill
5. Reinstall OpenClaw

---

**STAY VIGILANT** - Check blacklist before any skill installation.

---

**Last Updated:** 2026-02-20 13:54 PST
**Protocol Status:** 🔴 ACTIVE
