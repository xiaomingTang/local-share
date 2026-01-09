import { networkInterfaces } from "os";

export function getLocalIP(): string {
  const nets = networkInterfaces();
  const candidates: Array<{ name: string; address: string; score: number }> =
    [];

  const isIgnoredInterface = (name: string) =>
    /wsl|vEthernet|hyper-v|docker|vmware|virtualbox|loopback|tailscale|zerotier/i.test(
      name
    );

  const scoreIp = (ip: string) => {
    if (ip.startsWith("192.168.")) return 30;
    if (ip.startsWith("10.")) return 20;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 10;
    if (ip.startsWith("169.254.")) return -100;
    return 0;
  };

  for (const name of Object.keys(nets)) {
    if (isIgnoredInterface(name)) continue;

    for (const net of nets[name]!) {
      if (net.family !== "IPv4" || net.internal) continue;
      const score = scoreIp(net.address);
      if (score < 0) continue;
      candidates.push({ name, address: net.address, score });
    }
  }

  if (candidates.length === 0) {
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]!) {
        if (net.family !== "IPv4" || net.internal) continue;
        const score = scoreIp(net.address);
        if (score < 0) continue;
        candidates.push({ name, address: net.address, score });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.address || "localhost";
}

export function getAvailablePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = require("net").createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}
