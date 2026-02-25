# Port Scanning

## Nmap vs. Masscan vs. Naabu

-   **Nmap:** A versatile and powerful network scanner, offering a wide range of scanning techniques, OS detection, and scriptable interaction.
-   **Masscan:** Designed for high-speed port scanning of large IP ranges, capable of scanning the entire internet in minutes.
-   **Naabu:** A fast port scanner written in Go, focused on simplicity and speed, often used in conjunction with other tools.

## Scan Strategies

-   **Stealth Scan (SYN scan):** Sends SYN packets and waits for SYN/ACK. If received, it sends RST instead of ACK to avoid completing the handshake, making it less noisy.
-   **Connect Scan:** Completes the TCP three-way handshake, which is less stealthy but more reliable.
-   **UDP Scan:** Scans for open UDP ports, often slower and less reliable than TCP scans.

## Real Commands

```bash
nmap -sS -p 1-65535 target.com
masscan -p1-65535,U:1-65535 192.168.1.0/24 --rate 100000
naabu -host target.com -p - -o open_ports.txt
```
