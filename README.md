# Ayngaran Stores

A working owner-operated POS application built with **Next.js 16, React 19, Express 5 and Supabase**, with an ivory, burgundy and saffron Vinayagar-inspired design. Currency is **LKR**, and daily reporting uses **Asia/Colombo**.

For the current manual deployment steps, see [Deployment](docs/DEPLOYMENT.md). For validation evidence and historical release notes, see [Final verification](docs/RELEASE-CHECK.md).

Public builds open the live store with no sample products or sample import controls. Configure Supabase before building and sign in with your owner account. Customer lists can be sorted by name, village, outstanding balance, or credit limit.

## Start locally

Requires Node.js 22 or newer.

```bash
npm ci
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from your Supabase project.
npm run dev
```

Open http://localhost:3000. Next.js serves `/api/*` through the existing Express app in the same Node process. A separate port-4000 server is no longer required. `API_PORT` applies only if running `server/index.mjs` separately.

The selected project is Ayngaran Stores. Configure `.env.local` from `.env.example` using that project's active publishable key. The new project's key and database setup have not yet been verified in this workspace. No service-role key is needed.

## Sample and live workspaces

- **Sample mode (explicit test builds only)** requires `NEXT_PUBLIC_ENABLE_SAMPLE_MODE=true` at build time. It starts with 16 products, three customers and two suppliers. Changes persist in this browser's local storage. It is labelled throughout, including printed sample receipts. This is not a cloud backup.
- **Open live store** opens Supabase email/password sign-in. Use an existing account supplied by your administrator. Public registration is disabled; administrators create accounts inside Settings after the server settings in the deployment guide are configured.
- Live accounts start with an empty store. Sample data is never silently imported. Explicit test builds can enable the empty-store-only dummy import; public builds hide and block sample imports.
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

This is a functional single-owner application foundation, **not a certified enterprise ERP**. The relational upgrade stores business entities and line items in separate owner-scoped tables, with revision locking and a request table for idempotency. See [database architecture and migration](docs/DATABASE-ARCHITECTURE.md). Before applying that migration, the adapter supports the original versioned JSONB store. Product images remain compressed WebP data URLs; after migration they have their own table. This keeps checkout changes atomic and setup straightforward, but the compatibility API still reads the whole store per operation and images count toward response size; normalized commits write only changed records.

For high transaction volumes or large catalogues, move to normalized products, sale lines, movements and ledger tables, move images to Supabase Storage, paginate reports and introduce retention/archival. Owner RLS is the security boundary; owners have write privileges on their own aggregate. It is not a tamper-proof accounting ledger and there are no cashier/manager roles, multi-branch sharing, partial returns, payment gateway, automated backup scheduling or offline cloud-sync queue in this release.

## Deployment

The production build passes using:

```bash
npm run build
npm start
```

Deploy Next.js on a Node-capable host behind HTTPS, with Supabase public configuration supplied at build time and runtime. The existing Express API runs inside Next.js; publish only the Next.js service. Camera access requires HTTPS outside localhost. Follow the [manual deployment guide](docs/DEPLOYMENT.md); deployment and live-owner acceptance are performed by the owner.

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

Use **Settings → Daily Excel backup** for a selected-day report and full current snapshot. Use **Check live connection** for an authenticated health check. Explicit sample-enabled test builds also provide **Load dummy data** for empty test accounts. See the release guide for final owner acceptance and hardware checks.

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


## Hosting and product-save availability

Deploy as a Next.js application with Node.js API support, not a static export. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the hosting environment before building. Build with `npm run build`; on a Node server start with `npm start`. On managed Next.js hosting use its normal Next.js deployment settings.

After deploying, open `/api/health` on the website: it must return JSON with `ok: true`. `/api/state` without signing in must return a JSON 401 response. A 404 or HTML page means the API deployment is missing; a 502/503 usually means the host failed to start the server. Product creation and all other mutations still require a verified Supabase user and owner-scoped database permissions.


## Recommended database upgrade

Use the [relational architecture and migration guide](docs/DATABASE-ARCHITECTURE.md) to upgrade the two-table store without changing the billing workflow. The migration creates 16 business tables, preserves existing data, and adds owner-protected balance and daily-sales views. Deploying code alone does not migrate the database.

### Compare supplier buying costs

On **Suppliers**, click **Compare buying costs** to open the comparison dialog, then search a product name, brand saved in its name, SKU, barcode, or supplier company. For example, save products as “Alpha Chilli Powder 100g” and “Beta Chilli Powder 100g”; searching “chilli” shows both. Each supplier has a separate row showing their latest recorded buying cost. Expand **Previous purchases** to see older costs and invoice numbers. Products without purchases show their current catalogue cost, clearly labelled.

Sort by buying cost or potential margin to plan restocking. Margin is `(current selling price − buying cost) / current selling price × 100`; compare the same pack sizes and units, and allow for tax, discounts, other expenses and updated supplier quotes. This comparison does not change inventory or prices.

### Pasted supplier sample list

In an explicitly enabled **test Sample workspace**, click **Load supplier sample list → Add supplier sample products**. This appends 184 entries from the supplied list, retaining Sinhala names alongside English search names, sizes, variants and source price quotes. Existing sample data stays intact; the list loads only once per browser. Search **toothpaste**, **soap**, **milk powder**, **Coca-Cola**, **Signal**, or the Sinhala name under **Suppliers → Compare buying costs**.

Buying/selling pairs are interpreted as LKR costs and selling prices. The final parentheses are retained as quoted case quantities, not inventory. One fully paid, explicitly labelled sample purchase supplies 12 test units for each of 182 priced entries. Its history is generated for testing and is not a real invoice. Ameens Henna and OBO A4 Laminating Pouch have no supplied selling price and remain inactive with zero stock. Soorya Matches' `(8490)(14400)(720)` is interpreted as cost/selling/case quantity and flagged for review. Conditional bulk-order pricing is preserved in the source text but is not applied automatically. No real barcodes or supplier identity were supplied; barcodes remain empty and the supplier is labelled as sample data. Live stores are unaffected.

Source: `data/supplier-sample-source.txt`; reviewed entries: `data/supplier-sample-products.json`. The imported quote appears in the cost comparison. Treat each cost as applying to its listed unit/pack; do not compare mismatched pack sizes as unit prices.

### Full-width billing and keyboard quantities

The side navigation is closed by default on desktop and mobile, leaving the main area for products and the current bill. Use the menu button to open it; choose a page, press Escape, click outside it, or use its close button to dismiss it.

Click a product or search its SKU/name and press Enter. Its bill quantity is focused and selected automatically: type the required quantity (for example `2.5`) and press **Enter** to save it and return to product search. **Escape** keeps the previous quantity and returns to search. Invalid, empty, or over-stock quantities cannot be committed with Enter. **F2** opens billing and focuses search from another page. Dedicated hardware scanner input keeps focus for repeated scans; each scan still adds one unit.

### Billing fits the screen

Billing uses the available screen height, with the total and Charge button kept in view. The product grid and bill items scroll independently instead of extending the whole page. On phones, **View bill / Back to products** switches between the two within the same screen. Adding a product opens its quantity in the bill; Enter returns to product search. Other pages retain their normal scrolling. On unusually short screens (including when a phone keyboard reduces the viewport), the panels can scroll internally so controls remain reachable.

### Login and user management

Public access is login only. Signed-out visitors cannot open the application screens. Configured administrators can create users in **Settings → Create user**; each new user has a separate store. Follow the [administrator setup](docs/DEPLOYMENT.md#login-only-access-and-administrator-created-accounts) to disable Supabase public signup, configure administrator UUIDs, and supply the server-only secret. Never use the server secret as a public browser key.

### Delete a product

First close the product’s inventory: sell its remaining stock or use **Inventory → Adjust** with a reason so stock reaches zero. Deletion is blocked while stock remains. On **Products** or **Inventory**, choose **Delete** beside a product, review the confirmation, type `DELETE`, and click **Delete product**. Cancel leaves the product unchanged. Remove the product from the current bill or held bills first.

Deleted products disappear from Products, billing searches/scanners and new purchase selections. Existing bills, purchases, prices and stock movements keep their original records. The zero-stock record stays visible in **Inventory**, labelled **Deleted**. If a past sale is voided later, the returned stock remains visible there and included in stock value. Inventory adjustments and voiding past sales continue to work. The product's original SKU/barcode remains reserved for historical consistency. Deletion is an update to the existing owner-scoped product record; no database migration or extra database permissions are required.

### Mobile product photos and scanning

In **Products → Add product** (or **Edit**), choose **Take photo** to open the phone’s camera, or **Choose from photos** for an existing image. Photos are resized to a maximum of 600 pixels and saved as WebP; wait for optimization before saving the product. The phone/browser controls camera availability and may offer a file chooser on desktop.

In **Point of sale → Scan**, allow camera access and point the rear camera at a barcode or QR code. Auto mode reads both; you can also select a specific scan type. A matching product is added once and its bill quantity is selected. Return **Back to products → Scan** to scan another item; rescanning the same product increases its quantity within available stock. Codes must match the product’s saved barcode, SKU or product ID. Unknown or unavailable codes do not add a bill item. Camera scanning requires HTTPS on a deployed phone browser; allow camera permission in the browser’s site settings. Hardware scanning and manual code entry remain available.

### Product discounts and bill totals

Set a default **Discount type** and **Discount value** in Add/Edit Product. Choose an amount in LKR **per unit** or a percentage of the original selling price. Zero means no product discount. In Point of Sale, the default applies when a product is added; adjust the type/value beside its bill line for this bill without changing the product default. A fixed Rs. 10 discount on quantity 2 saves Rs. 20. Repeated scans keep the selected line discount.

Product cards and bill lines show the original and discounted unit prices. The bill shows the original subtotal, product discounts, any additional bill discount, total discounts, tax and final payable amount. Receipts show each original unit price, discount, final unit price and line total, plus all discount totals. Unit discounts round to cents first, then quantity-based line totals round to cents. Tax applies after all discounts. Discounts cannot exceed 100% or the original unit price; the additional bill discount cannot exceed the amount remaining after product discounts.

Checkout saves original prices, costs and discount details for historical receipts and profit. Held bills retain their selected discounts. Existing receipts without product discounts keep their previous totals. Excel backups include the new discount details. Existing normalized database metadata stores these fields, so this feature needs no database migration.

### Opening cash, closing the drawer and customer cash loans

Open **Cash drawer** from navigation (also shown on Dashboard). Enter the cash physically present and choose **Start drawer**. Opening is optional: sales, collections and customer loans can continue without it. A drawer tracks only cash activity recorded while it is open on that Sri Lanka calendar day. Earlier cash belongs in the opening count. Only one drawer can be open; close a previous day before starting a new one.

Expected drawer cash is opening cash plus net cash sales received, cash credit collections and explicit cash additions, less cash purchases, supplier payments, customer cash loans paid from the drawer and explicit withdrawals. Cash sale change is already deducted. Card/bank payments and owner funds supplied outside the drawer are excluded. Select the payment method when receiving collections, paying suppliers or recording purchases. Initial part-payments on a Credit sale are treated as cash.

At the end of the day, enter **Counted cash**, explain any difference, and choose **Close drawer**. Expected, counted and difference figures are saved in Drawer history. Subsequent activity cannot change that closing record; start another drawer to track later cash. Voiding a bill does not physically refund money: record an actual cash refund as **Cash out** with its bill reference in the reason. Negative expected cash is flagged for review.

On **Customers**, choose **Lend cash** or use **View account → Lend cash to customer**. Enter the amount, money source and reason. This increases outstanding credit, respects the customer’s credit limit and appears as a separate debit in the account ledger. It creates no sale bill, stock movement, tax or sales profit. Choose **Owner funds outside drawer** if the money is not taken from the store drawer. Record repayments with the existing **Record collection** action. Excel backups include customer cash credits, drawer sessions and cash movements.

Before deploying this release, run [`supabase/migrations/20261027090000_cash_credit_balances.sql`](supabase/migrations/20261027090000_cash_credit_balances.sql) after the existing normalized-storage migration. This rerunnable, non-destructive view update makes SQL customer balances include cash loans. See [Deployment](docs/DEPLOYMENT.md). It has not been applied to your live database here.

### Supplier payment priorities

Suppliers opens with outstanding payables and reminder priorities. **Compare buying costs** is a single button; the comparison occupies space only while its dialog is open. Purchase recording and history remain available.

Choose **Plan dates** beside a supplier to set the payment due date, next cheque date/amount/reference, last supplier visit and next visit. These are reminders, not payments. Dates and cheque details do not reduce outstanding balances or move drawer cash. Record a bank payment once a cheque clears, then clear its reminder date, amount and reference. Last payment is derived from actual supplier payments and paid purchase invoices, shown in Sri Lanka time.

Default priority is overdue scheduled items, today, upcoming dates, then outstanding balances without dates and settled suppliers. Among matching priorities, the nearest date and largest payable come first. Payment/cheque urgency applies only where money is outstanding; scheduled visits can still appear for a settled supplier. Use **Sort suppliers** for highest payable, nearest cheque, next visit, oldest last payment or name, and search to narrow the list. **Pay supplier** opens the existing payment form. Reminder fields persist in existing supplier metadata and Excel backups; this update requires no new migration or environment settings. The earlier cash-loan balance-view migration remains required if it has not already been applied.

### Upcoming cheques and payment at the next visit

At the top of Suppliers, **Upcoming supplier payments** shows all dated payable reminders, including overdue items, in date order. A supplier’s next cheque is the primary payment reminder. If there is no scheduled cheque, **Plan dates → Payment due at next supplier visit** makes the next visit date a payment reminder for the remaining outstanding balance. Enter a next visit date when selecting this option. Otherwise, a standalone payment due date is shown if available. Undated and settled accounts remain in the supplier list below. A visit date alone remains a visit reminder unless the payment option is selected.

The overview shows the cheque amount (or “Not set”), remaining payable and a Record payment button. It includes every supplier regardless of the search below and scrolls internally for longer lists. Recording a cheque payment defaults to bank; a visit payment defaults to cash, and you can change the method. Scheduling never records a payment or changes the balance. After a cheque clears, record the actual payment and clear its cheque reminder; a configured next-visit payment then becomes the primary reminder. No new database migration is needed.

### Show purchase costs while billing

In **Point of Sale → Current bill**, click **Show purchase costs** to reveal each product’s current saved purchase cost per unit and its quantity-based line cost. Click **Hide purchase costs** to hide them. Costs are hidden by default and are not remembered across reloads. Leaving POS or emptying/completing/holding the bill resets visibility. The displayed cost is the current product cost, not a supplier quote or a full purchase-cost history. It does not change selling prices or bill totals. Purchase costs are excluded from customer receipts and print output.

### Import the photographed CBL purchase bill

The 62 paid lines from the bill printed 21 October 2026 are transcribed in [`data/purchase-bills/cbl-2026-10-21.csv`](data/purchase-bills/cbl-2026-10-21.csv). A guarded manual [SQL import](supabase/imports/cbl-2026-10-21.sql) can create the catalogue, invoice quantities (including two free Bubbles 30g packs) and purchase history for one explicitly configured owner. Read the [bill review and configuration](data/purchase-bills/README.md) first. Printed purchase rates already include 10% or 15% off MRP; the owner chose proportional allocation of the further Rs. 1,795.05 discount across the chocolate/confectionery lines. SKUs continue after the existing AYS-105 product, from **AYS-106 through AYS-167**. The supplied owner UUID is prefilled. The script requires store/supplier/payment configuration and does not run automatically. No live database import has been performed.
