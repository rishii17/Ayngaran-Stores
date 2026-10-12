# Ayngaran Stores

A working owner-operated POS application built with **Next.js 16, React 19, Express 5 and Supabase**, with an ivory, burgundy and saffron Vinayagar-inspired design. Currency is **LKR**, and daily reporting uses **Asia/Colombo**.

For the latest features, security findings and final run instructions, see [Final verification](docs/RELEASE-CHECK.md).

## Start locally

Requires Node.js 22 or newer.

```bash
npm ci
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from your Supabase project.
npm run dev
```

Open http://localhost:3000. Next.js forwards `/api/*` to Express on `127.0.0.1:4000`. Both processes start together. `API_PORT` is for the API process; the Next.js rewrite uses the same `API_PORT` setting.

The selected project is Ayngaran Stores. Configure `.env.local` from `.env.example` using that project's active publishable key. The new project's key and database setup have not yet been verified in this workspace. No service-role key is needed.

## Sample and live workspaces

- **Sample mode** starts with 16 products, three customers and two suppliers. Changes persist in this browser's local storage. It is labelled throughout, including printed sample receipts. This is not a cloud backup.
- **Open live store** opens Supabase email/password sign-in. Create an owner account if needed, confirm the email if Supabase requires it, then sign in.
- Live accounts start with an empty store. Sample data is never silently imported. Settings offers an explicit, empty-store-only dummy import from the Supabase template.
- Each signed-in owner has an isolated store. This release does not share stores across different staff accounts.
- The selected live workspace is restored on reload. Failed cloud saves report an error and do not fall back to local sample storage.

## Implemented workflows

### Billing

Name, Tamil name, SKU and barcode substring search; Enter adds an exact SKU/barcode match or the sole search result. USB scanners that act as keyboards work in the search field. Camera scanning uses ZXing and the rear camera when available. Scanner input also has a manual fallback. F2 focuses search and F4 opens scanning.

Products can be added with a click; quantities accept two decimal places for weighed goods. The bill supports discount amounts, configurable tax, customer selection, cash/change, card recording and partial-payment customer credit. Card payments must be taken on a separate payment terminal: this application records them but does not process cards.

Completed checkout updates stock, the sales record, customer debt and movement history as one state commit. Credit limits and available stock are checked again by the Express domain layer. Held bills can be resumed. Full-sale voids restore stock and reverse the sale's credit; collected external cash/card refunds must be performed separately. Voiding a credit sale is blocked if it would leave a negative account balance.

### Products and inventory

Product creation/editing, categories, SKU, barcode, camera barcode capture, bilingual names, units, selling price, purchase cost, reorder thresholds and optional images. Images are resized to at most 600 pixels and converted to WebP. Product edits preserve stock: use stock adjustments or purchase receiving to change quantity and retain a movement record.

Stock views show quantity, cost value, low-stock filters and timestamped movements for opening stock, sales, purchases, voids and reasoned adjustments. Negative stock is blocked.

### Customers, suppliers and reports

Customer and supplier profiles, opening balances, customer credit limits, account ledgers, customer collections and supplier payments. Purchases receive multiple products on one supplier invoice, with quantities, unit costs and selling prices. One payment and outstanding balance cover the complete invoice. Search by name, Tamil, SKU or barcode; Enter adds the first match. Excel backups include invoice summaries and purchase lines.

Dashboard with daily totals, bill count, outstanding customer credit, low stock and a seven-day sales chart. Sales reports include date/customer/bill filters, collections on bills, credit issued, gross profit, separate subsequent collections/payments, receipt reprints and void status. CSV exports, daily Excel workbooks with complete current-store snapshots, and full JSON backup export are included. The JSON export is for data portability; an import/restore UI is not included.

### Counter utilities

Calculator, responsive mobile layout with a jump-to-bill button, thermal receipt layout (80 mm), and store/receipt settings. Receipts snapshot seller settings at checkout so later setting changes do not rewrite historical seller information.

## Supabase setup

Project: **Ayngaran Stores** (`uoddttvmpqkojdwofcxr`). The application requires these database objects:

- `public.ayngaran_stores`
- `public.ayngaran_requests`
- `public.ayngaran_commit(...)`
- `public.ayngaran_seed_templates` (dummy reference data only)

The setup scripts do not modify unrelated tables.

`supabase/schema.sql` contains the required initial schema. For a fresh project, run it once, followed by `supabase/seed-template-schema.sql` and `supabase/dummy-data.sql`, in the Supabase SQL editor, enable email authentication and set the Auth Site URL to your application origin. If the tables and policies already exist, inspect their configuration before rerunning the initial schema.

RLS restricts every row to its authenticated owner. Anonymous table access and commit execution are revoked. The commit function is SECURITY INVOKER with an empty search path. Express validates the JWT with `auth.getUser`, executes with the caller's JWT and uses optimistic revision checks plus a row lock and unique request IDs to avoid lost updates and duplicate committed retries. It retries revision conflicts up to five times.

### Architecture and production scope

This is a functional single-owner application foundation, **not a certified enterprise ERP**. Store state is a versioned JSONB aggregate, with a request table for idempotency. Product images are compressed WebP data URLs inside that state. This keeps checkout changes atomic and setup straightforward, but the whole store is read/written per operation and images count toward response size.

For high transaction volumes or large catalogues, move to normalized products, sale lines, movements and ledger tables, move images to Supabase Storage, paginate reports and introduce retention/archival. Owner RLS is the security boundary; owners have write privileges on their own aggregate. It is not a tamper-proof accounting ledger and there are no cashier/manager roles, multi-branch sharing, partial returns, payment gateway, automated backup scheduling or offline cloud-sync queue in this release.

## Deployment

The production build passes using:

```bash
npm run build
npm start
```

Deploy both Next.js and Express on a Node-capable host behind HTTPS, with the environment variables configured at build time (public frontend configuration) and runtime (Express). The Express port stays private; publish the Next.js port. Camera access requires HTTPS outside localhost. No production hosting deployment has been made from this workspace. Sites' Cloudflare Worker runtime does not directly host this separate Express server, so the requested Node/Express architecture was preserved.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

- Domain/API tests cover cash/change, fractional quantities, discounts/tax, duplicate-line overselling, credit limits, partial payment and collection, supplier purchases/payments, full voids, adjustments, duplicate identifiers and held bills.
- Chromium checks cover cash and credit checkout, sample persistence after reload, SKU search, creating products/customers, desktop/mobile layout, purchases, payments, optional WebP upload, barcode fallback, held bills, printing, voiding and calculator.
- Live read-only Supabase checks verified RLS owner policies, invoker permissions and revoked anonymous access. The security advisor reported only two informational notices on the pre-existing `pos_*` tables; the new tables had no security findings. The existing notices are described in [Supabase’s RLS policy advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- A proposed rollback-only test using fabricated auth records was rejected by automatic approval review. No such test records were created. Signed-in end-to-end cloud checkout and concurrency were not exercised against the live project. Test them with a real authorized owner before trading.
- Camera hardware and a physical thermal printer cannot be tested from this remote environment; barcode manual entry and print PDF rendering were checked.

## Source map

- `components/store-app.tsx` — POS, management screens, dialogs and receipt UI
- `components/scanner.tsx` — camera lifecycle and ZXing decoding
- `components/product-art.tsx` — original lightweight product illustrations and Vinayagar mark
- `lib/domain.mjs` — shared transaction rules and sample data
- `lib/client.ts` — authenticated API calls, image compression and exports
- `server/app.mjs` — validation, authentication, API and Supabase persistence
- `supabase/schema.sql` — initial database schema and RLS
- `tests/` — transaction and API tests

## New counter and account features

Search products using words in any order or Tamil names, and search POS customers by name, phone, code, ID or village. Customer accounts provide bill search and receipt review. The preset villages and optional custom villages are stored with customers. A new POS customer is automatically selected.

Use **Products → Price** to update selling price/cost with a reason. The history records each change. Gross profit on completed sales uses the cost recorded at checkout; later cost changes never rewrite old sale profits. Owner profit displays are kept outside customer printouts.

Use **Settings → Daily Excel backup** for a selected-day report and full current snapshot. Use **Check live connection** for an authenticated health check and **Load dummy data** only for an empty test account. See the release guide for final owner acceptance and hardware checks.

Quick calculator shows calculation steps and operand count. Mouse and keyboard share the same controls: digits, decimal, +, -, *, /, Enter, Backspace and C/Delete. Calculations run left to right, rounded to two decimals; history retains the last 100 steps while open.

### Account creation: “Invalid API key” on a local computer

Open **Ayngaran Stores → Settings → API Keys** in Supabase. Copy its active **publishable** key (starts with `sb_publishable_`) into `.env.local` in the app folder, beside `package.json`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://uoddttvmpqkojdwofcxr.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=replace_with_the_actual_publishable_key
API_PORT=4000
```

Do not copy a secret/service-role key or leave the example placeholder. `.env.local` stays on your computer and is intentionally excluded from GitHub. Stop the app with Ctrl+C and run:

```bash
npm run check:auth
npm run dev
```

If using production mode, use `npm run build` followed by `npm start` instead. Next.js embeds public keys at build time, so restarting an old production build does not update them. Reload the browser after restarting. `check:auth` makes a read-only Auth request without creating a user or sending email; it distinguishes a rejected key from a network failure.

Supplier purchases support multiple product lines and camera barcode/QR scanning. Use **Scan barcode / QR** for each item, or focus **Find products** for a USB/Bluetooth scanner that types a code and Enter. Repeated scans increase quantity. Store the exact QR content in the product's Barcode field; SKU and product ID also match in purchases. QR decoding does not convert arbitrary payment links or website addresses into products. Camera support and readability depend on device/browser and lighting.

## Hardware barcode scanners

The separate mobile scanner and pairing server have been removed. Start normally with `npm run dev` and open `http://localhost:3000`. No phone pairing, Wi-Fi firewall rule or local HTTPS certificate is required for a hardware scanner.

Use the **Hardware scanner** input in POS or Record purchase. Configure your scanner as a keyboard/HID device (or use the manufacturer's keyboard-output software) with **Enter/CR** as its suffix. Click the input once, then scan repeatedly. Each valid code adds one unit, preserves leading zeroes, and keeps focus for the next scan. Unknown codes are reported without adding a fuzzy search match. Enter never completes a bill or saves a purchase from this input.

An Ethernet-only TCP/UDP scanner does not automatically type into a browser. It requires a compatible vendor bridge that outputs keystrokes, or a model-specific integration. Do not assume that plugging an Ethernet scanner into a router is enough. Test it in Notepad: it should type the complete code and move to the next line. Select the keyboard layout matching Windows and disable custom prefixes. QR-capable hardware can submit a saved product code in the same way.

The existing camera scanner, multi-product purchases, product-price history and calculator keyboard controls remain available. Historical valid UPC/EAN leading-zero differences are supported.

Optional cleanup on your Windows computer: remove the old firewall rule with `Remove-NetFirewallRule -DisplayName "Ayngaran POS - Local WiFi"` in administrator PowerShell if it was only for the phone scanner. Remove the old home-screen shortcut and local CA trust if unused. Local certificate files remain ignored by Git and are not deleted automatically.
