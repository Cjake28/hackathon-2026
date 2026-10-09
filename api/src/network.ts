import { networkInterfaces } from 'node:os';

// Virtual adapters (WSL, Docker, VMs, VPN tunnels) can't be reached by phones on the Wi-Fi.
const VIRTUAL = /vethernet|wsl|docker|virtualbox|vmware|hyper-v|tailscale|zerotier|netbird|wireguard|vpn|loopback|^w[tg]\d/i;
const isVpnRange = (ip: string) => /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip); // 100.64.0.0/10

// This computer's addresses on the local network (Wi-Fi / Ethernet).
export function lanAddresses() {
  return Object.entries(networkInterfaces())
    .filter(([name]) => !VIRTUAL.test(name))
    .flatMap(([, addresses]) => addresses ?? [])
    .filter((a) => a.family === 'IPv4' && !a.internal && !isVpnRange(a.address))
    .map((a) => a.address);
}
