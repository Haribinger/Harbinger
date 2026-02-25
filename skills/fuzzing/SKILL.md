---
name: fuzzing
description: >
  Fuzzing and mutation testing skill for Harbinger CIPHER agent.
  Covers binary fuzzing with AFL++, web fuzzing with ffuf/wfuzz,
  API fuzzing, corpus generation, and coverage-guided mutation.
  Use when hunting memory corruption, input validation bugs, or unknown attack surfaces.
---

# Fuzzing Skill

CIPHER agent skill -- automated discovery of input validation and memory corruption bugs.

## Tools

- AFL++ -- coverage-guided binary fuzzer
- ffuf / wfuzz -- web and API fuzzing
- radamsa -- mutation-based fuzzer for any input
- boofuzz -- network protocol fuzzer
