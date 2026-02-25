---
name: crypto
description: >
  Cryptography analysis skill for Harbinger CIPHER agent. Covers TLS/SSL misconfiguration,
  JWT attacks (alg:none, RS256/HS256 confusion), cipher enumeration, padding oracles.
  Use when auditing TLS, attacking JWT auth, or testing cryptographic weaknesses.
---

# Crypto Skill

CIPHER agent skill -- cryptographic weakness identification and exploitation.

## Tools

- testssl.sh / sslscan / sslyze -- TLS/SSL audit
- jwt_tool -- JWT attacks (alg:none, weak secrets, RS256/HS256 confusion)
- openssl -- certificate inspection, cipher enumeration
- padbuster -- CBC padding oracle attacks
