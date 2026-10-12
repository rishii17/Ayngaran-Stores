# Ayngaran Mobile Scanner

The installable phone web app lives at `/mobile-scanner` on the same HTTPS site as the POS. It supports Android Chrome and iPhone Safari camera scanning, manual entry and keyboard barcode scanners. The scanner decodes supported barcode/QR formats; decoded text must identify an existing product by barcode, SKU or product ID. Payment QR codes and arbitrary URLs do not automatically identify products.

## Connect and use

1. Run Next.js and Express behind one shared HTTPS origin reachable by both devices. A phone's `localhost` refers to the phone, not your computer. Plain HTTP LAN addresses cannot use phone cameras. The existing Next `/api` proxy must reach Express.
2. Sign in on the desktop and open the live store. On POS or Record purchase, click **Connect phone scanner**. A new pairing replaces any previous pairing for that account.
3. Scan the displayed pairing QR with your phone's camera. Do not share the link with anyone else. It authorizes scan submission to that desktop but cannot read store or customer records or finalize payments.
4. Use **Scan next barcode / QR** or type a code. Wait for the desktop confirmation. A scan adds one unit; change weighed quantities on the desktop. Unknown codes and insufficient stock are reported without adding products. Verify the bill/purchase before saving.
5. On Android use Chrome's Install app/Add to home screen. On iPhone use Safari → Share → Add to Home Screen. Installation may start a separate browser session: if it loses pairing, reopen the pairing link or pair again. No offline scanning queue is provided.
6. Disconnect on the desktop to revoke the capability immediately. Disconnect on the phone removes its local pairing; desktop disconnection is required to invalidate copied links.

## Reliability and security

Pairings use random 256-bit tokens, last one hour and are stored only in the running Express process. Tokens are placed in the URL fragment (not the server URL), then removed from the address bar and retained in phone sessionStorage. Authenticated owner checks protect desktop queue access and revocation. Scans carry UUIDs; retrying a pending scan keeps its UUID. The phone waits for a desktop acknowledgement and displays the desktop's result. Acknowledgement means the draft received the scan, not that a sale or purchase has been saved.

Keep the desktop panel open. Navigating away revokes the session on a best-effort basis; browser termination may leave it active until expiry. Restarting Express loses pairings. Use one Express instance; multi-instance deployments require a shared session/queue store before enabling this feature. Do not reload the desktop with unacknowledged scans: check the draft and re-pair instead. Queue limits are 50 pending scans and 5,000 IDs per session. Existing API rate limits also apply.

## Verification and deployment status

Automated tests cover owner isolation, invalid capabilities, expiry/revocation, duplicate submission, bounded queues, phone endpoint responses and mobile acknowledgement UI. Physical phone camera, installation and same-origin HTTPS pairing require acceptance on your actual hosted deployment. No hosting deployment or live Supabase account provisioning is performed by this change.

Validation completed for this change: 35 automated tests, production build, TypeScript, existing POS/purchase/camera browser regressions, mobile browser UI and an isolated paired desktop/phone browser workflow all passed. npm audit reported zero vulnerabilities. Browser pairing tests use local fixtures, not the unconfigured live Supabase project. A pending scan ID survives a phone-page refresh in the same browser session so retries retain the same ID.

## Same Wi-Fi, manually entered computer address (Windows)

No public hosting is required for this mode. Keep both devices on the same trusted Wi-Fi, with client/AP isolation disabled. Supabase still requires internet for desktop sign-in and saving data.

1. Run `ipconfig` on the computer and find the Wi-Fi adapter's IPv4 address (example: `192.168.1.20`). Reserve that address in your router if possible.
2. Install **mkcert** from its official repository: https://github.com/FiloSottile/mkcert . Use it to create a local trusted certificate. In the app folder, run the commands below, replacing the example IP with your actual address:

```powershell
mkcert -install
New-Item -ItemType Directory -Force certificates
mkcert -key-file certificates/pos-key.pem -cert-file certificates/pos.pem localhost 127.0.0.1 ::1 192.168.1.20
mkcert -CAROOT
npm run dev:https
```

3. Install **only `rootCA.pem`** from the directory printed by `mkcert -CAROOT` on your own phone. Never copy/share `rootCA-key.pem` or `pos-key.pem`. This CA lets your computer issue trusted certificates, so install it only on devices you control. iPhone: install the certificate profile, then enable it under Settings → General → About → Certificate Trust Settings. Android: install the CA certificate through Security settings (menu names vary). Remove this local CA when it is no longer needed.
4. Allow Node TCP port 3000 through Windows Firewall for **Private networks only**. Do not expose Express port 4000 or forward these ports from the internet.
5. Open `https://192.168.1.20:3000` on both devices. It must load **without certificate warnings**. Click Connect phone scanner on the desktop after signing in. Enter this same HTTPS computer address in its address field, then scan the pairing QR or copy its complete pairing link into the phone app.
6. If the connection fails, check the IP, server process, firewall, guest-network isolation and certificate trust. If your computer IP changes, generate a certificate containing the new IP. Do not disable browser security or rely on clicking through certificate warnings to enable the camera.

This is a local development setup. `npm start` serves HTTP unless a separate HTTPS reverse proxy is configured. A trusted HTTPS reverse proxy is recommended for permanent use; route the Next app and its `/api` endpoints through the same origin.

## Diagnose a phone that cannot open the page

Keep `npm run dev:https` running, then open a second terminal in the app folder and run `npm run check:mobile`. It prints candidate computer addresses, checks certificate IP coverage/expiry and whether port 3000 is listening. It does not read private keys, change firewall rules or claim to test phone connectivity. Send this output and the exact phone URL/error for further diagnosis. A page that cannot load cannot diagnose itself; camera code changes cannot fix a blocked network port.

For product labels, choose **Product barcode only** in the scanner. The preview now displays the full camera image; leave blank space at both ends of the barcode. Valid UPC-A/EAN representations with leading-zero differences match the same saved product. Decoding a code and matching a catalog entry are separate: a decoded value must still be saved on an active product. Ambiguous matches are rejected.

Barcode regression checks now cover EAN-13 in low contrast, EAN-8, UPC-A, Code128, rotated Code128 and QR via synthetic camera streams, including a browser with QR-only native detection. The decoder retains the full camera resolution up to 1920 pixels and explicitly rotates fallback frames for vertical labels. All 36 domain/API tests, production build and browser suites passed. These checks do not replace testing a physical label and camera, or establish reachability on your Wi-Fi.
