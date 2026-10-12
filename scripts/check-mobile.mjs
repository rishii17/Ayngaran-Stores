import { networkInterfaces } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";
import { createConnection } from "node:net";
const port = Number(process.env.PORT || 3000);
let interfaces = {};
try {
  interfaces = networkInterfaces();
} catch {
  console.log(
    "Unable to list adapters here. Run ipconfig on your Windows computer for its Wi-Fi IPv4 address.",
  );
}
const ips = Object.entries(interfaces).flatMap(([name, rows]) =>
  (rows || [])
    .filter((r) => r.family === "IPv4" && !r.internal)
    .map((r) => ({ name, address: r.address })),
);
console.log(
  "Mobile Wi-Fi connection check (no passwords or API keys are printed)",
);
if (!ips.length)
  console.log(
    "FAIL: no active IPv4 network interface. Connect the computer to Wi-Fi.",
  );
for (const { name, address } of ips)
  console.log(`${name}: https://${address}:${port}/mobile-scanner`);
console.log(
  "Choose the Wi-Fi/Ethernet address on the same network as the phone, not a VPN/virtual adapter.",
);
let cert;
try {
  cert = new X509Certificate(readFileSync("certificates/pos.pem"));
  console.log("Certificate expiry: " + cert.validTo);
  if (Date.parse(cert.validTo) < Date.now())
    console.log("FAIL: HTTPS certificate expired. Regenerate it.");
  for (const { address } of ips)
    console.log(
      `${cert.checkIP(address) ? "PASS" : "CHECK"}: certificate ${cert.checkIP(address) ? "includes" : "does not include"} ${address}`,
    );
} catch {
  console.log(
    "FAIL: certificates/pos.pem is missing or invalid. Complete the mkcert setup in docs/MOBILE-SCANNER.md.",
  );
}
console.log(
  existsSync("certificates/pos-key.pem")
    ? "PASS: local HTTPS key file exists (not read)."
    : "FAIL: certificates/pos-key.pem is missing.",
);
const reachable = await new Promise((resolve) => {
  const socket = createConnection({ host: "127.0.0.1", port });
  socket.setTimeout(2000);
  socket.on("connect", () => {
    socket.destroy();
    resolve(true);
  });
  socket.on("error", () => resolve(false));
  socket.on("timeout", () => {
    socket.destroy();
    resolve(false);
  });
});
console.log(
  reachable
    ? `PASS: a server is listening on port ${port}. This does not verify HTTPS or phone access.`
    : `FAIL: nothing is listening on port ${port}. Run npm run dev:https and leave that terminal open.`,
);
console.log(
  "On the computer, open the Wi-Fi HTTPS URL above. If it works there but not on the phone, check Windows Firewall (Node on Private networks), same Wi-Fi, guest/AP isolation, and VPN. If a certificate warning appears, install and trust only rootCA.pem on the phone. Do not share private key files.",
);
