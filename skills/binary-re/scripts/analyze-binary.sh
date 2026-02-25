#!/usr/bin/env bash
# Quick binary reconnaissance — mitigations, strings, imports, functions
# Usage: ./skills/binary-re/scripts/analyze-binary.sh <binary>
set -euo pipefail

BINARY="${1:?Usage: analyze-binary.sh <binary_path>}"
OUT_DIR="binary-analysis/$(basename "$BINARY")_$(date +%Y%m%d%H%M%S)"
mkdir -p "$OUT_DIR"

echo "[*] Analyzing: $BINARY"
echo "[*] Output:    $OUT_DIR"

echo "[1/5] File type and architecture..."
file "$BINARY" | tee "$OUT_DIR/filetype.txt"

echo "[2/5] Security mitigations..."
if command -v checksec &>/dev/null; then
    checksec --file="$BINARY" | tee "$OUT_DIR/checksec.txt"
elif python3 -c "from pwn import ELF" &>/dev/null 2>&1; then
    python3 -c "from pwn import *; context.log_level='error'; e=ELF('$BINARY'); print(e.checksec())" | tee "$OUT_DIR/checksec.txt"
else
    echo "checksec not available — install pwntools or checksec" | tee "$OUT_DIR/checksec.txt"
fi

echo "[3/5] Interesting strings..."
strings -a "$BINARY" | grep -iE "(password|flag|key|secret|admin|token|auth|user|cmd|exec|system|sh)" \
    > "$OUT_DIR/strings-interesting.txt" 2>/dev/null || true
echo "  Found $(wc -l < "$OUT_DIR/strings-interesting.txt") interesting strings"

echo "[4/5] Imported functions (dynamic)..."
objdump -d --dynamic-reloc "$BINARY" 2>/dev/null | grep -oP '<[^@>]+@' | sort -u \
    > "$OUT_DIR/imports.txt" || true
nm --dynamic "$BINARY" 2>/dev/null | grep " U " | awk '{print $2}' \
    >> "$OUT_DIR/imports.txt" || true
sort -u "$OUT_DIR/imports.txt" -o "$OUT_DIR/imports.txt"
echo "  Found $(wc -l < "$OUT_DIR/imports.txt") imported symbols"

echo "[5/5] Symbol table..."
nm "$BINARY" 2>/dev/null | grep -v " U " | tee "$OUT_DIR/symbols.txt" | wc -l \
    | xargs -I{} echo "  {} exported symbols"

echo "[*] Analysis complete. Results in $OUT_DIR/"
ls -la "$OUT_DIR/"
