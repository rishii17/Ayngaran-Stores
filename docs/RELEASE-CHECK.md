> Project switch: Ayngaran Stores (`uoddttvmpqkojdwofcxr`) is now the target. Cloud checks described below are historical checks against the previous project; they do not verify this new project. A matching public key and project access are still required.

# Final verification — 12 October 2026

Verified locally: **29 automated tests**, production build, TypeScript checks and both browser suites passed. The full dependency audit reported **zero vulnerabilities**.

## Delivered

- Next.js frontend and Express API use the ignored `.env.local` Supabase configuration. `npm run check:env` validates the URL and public client key without printing values or accepting service-role/secret keys in the browser.
- The repository includes a separate authenticated-read-only dummy template with 16 products, three customers, two suppliers, seven sales, one purchase and one customer collection. Load it from Settings after signing into an **empty** owner store. Existing trading records cannot be replaced by the seed action.
- Daily Excel download contains a selected-day summary and sales, complete transaction history, current products/customer/supplier balances, stock movements, price history, villages and a recoverable full JSON snapshot. Date grouping uses Asia/Colombo. Current balances and stock are explicitly labelled as current, not historical day-end balances. Download manually at day-end; no unattended scheduled job is implied.
- Product search matches words in any order, Tamil text, SKU and barcode, with exact matches ranked first. POS customer search supports name, phone (with or without spaces), code, ID and village. A customer added at POS is immediately selected.
- Villages: A Division, B Division, 12 Ekar, KR division, Hopton, Millabedha; custom villages are optional and saved for reuse.
- Each customer has searchable bill history with receipt viewing/printing. Sales can be filtered to a customer and searched by bill number, sale ID, phone, name or village.
- Price updates retain old/new selling prices, costs, timestamps and reasons. Historic sale costs/prices are immutable through the product-edit workflow. Reports and the owner-only receipt dialog show gross profit after discount, excluding tax and overheads. Customer receipts do not print profit.
- Scanner uses native BarcodeDetector when available, ZXing fallback, a 100 ms retry interval, rear-camera preference, continuous focus/exposure where supported, real frame enhancement in low light, optional hardware torch, camera selection and zoom when available. Streams stop when the scanner closes or succeeds. Dummy EAN-13 codes have valid checksums.

## Security checks

- `npm audit`: zero reported vulnerabilities across production and development dependencies at the release check. ExcelJS's transitive UUID dependency is pinned to the patched 11.1.1 version; workbook creation/readback is tested.
- Owner-only row-level policies remain enabled on `ayngaran_stores` and `ayngaran_requests`. Anonymous table access/commit is revoked. `ayngaran_commit` is SECURITY INVOKER, not a privilege-bypassing function.
- Dummy templates enable RLS, allow authenticated reads, and deny anonymous reads and authenticated writes. Their all-authenticated read policy is intentional: this table contains only generated reference/sample data, never owner records.
- API authentication uses Supabase `getUser`, validation uses Zod, API responses use `Cache-Control: no-store`, body sizes are limited and rate limiting remains enabled.
- Application responses deny framing, disable MIME sniffing, restrict camera use to the same origin and disable microphone/geolocation permissions.
- Excel user-entered strings are stored as string cells, not formulas. Barcode/phone identifiers remain strings; values used for calculation remain numeric. Recovery chunks preserve Unicode boundaries.
- `.env.local`, dependency folders, build caches and test artifacts are excluded from Git. `.env.example` contains placeholders only.
- Supabase advisor has no findings for the app's three `ayngaran_*` tables. Two informational [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) notices remain on pre-existing `pos_shops` and `pos_receipts`, which this application does not use. Their policies were not broadened merely to silence a notice.

This remains an owner-operated app. The owner can modify their own aggregate through the database API; this is not a tamper-proof multi-staff accounting system. Security checks are evidence of the checks performed, not a penetration-test certification.

## Run on your computer

```bash
npm ci
# Copy .env.example to .env.local and fill the Supabase publishable key.
npm run verify
npm start
```

Open `http://localhost:3000`. The selected project has changed; its publishable key must be configured in the ignored `.env.local`. On another computer, take the publishable key from Ayngaran Stores → Project settings → API. Never use a secret/service-role key for `NEXT_PUBLIC_*`.

Database setup in the newly selected Ayngaran Stores project has not yet been verified. For a fresh project, run these SQL files in order once:

1. `supabase/schema.sql`
2. `supabase/seed-template-schema.sql`
3. `supabase/dummy-data.sql`

Use `npm run seed:generate` only to regenerate the dummy SQL locally; it does not execute SQL or modify any owner store.

## Final owner acceptance

1. Sign in to **Open live store**. Configure Supabase Auth's site URL/email confirmation for your own hosted origin if necessary.
2. In Settings, click **Check live connection**. This checks a real authenticated API/database request and displays its revision.
3. If this is a test store with no records, use **Load dummy data into empty store** and type `LOAD DUMMY DATA`. Dummy transactions affect reports; use a dedicated test owner account rather than importing them into the owner account intended for real trading.
4. Add a customer and village at POS; make a test credit sale; review that customer's bill, collect a payment and verify the outstanding balance.
5. Update a product price and verify the old bill's profit stays unchanged.
6. Download Excel and check its worksheets; keep a copy outside the device.
7. Test rear-camera scanning, low-light enhancement/torch and your actual thermal printer on the intended device.

Read-only cloud checks and sample-template seeding passed. No authenticated owner store existed during this build, so a real-owner cloud checkout has **not** been claimed as verified. No fabricated auth users were created. HTTPS hosting has not been deployed by this change.

## Reproducible checks

```bash
npm test
npm run build
npm run typecheck
npm run check:env
npm run audit:security
# While npm start is running, with Chromium installed:
npm run test:browser
```

`CHROMIUM_PATH` selects the browser executable (default `/usr/bin/chromium`); `POS_TEST_URL` selects the test server (default localhost:3000). Browser tests use isolated sample-mode profiles, never your live data, and write ignored files to `artifacts/`.

Browser checks cover POS village creation/selection, credit billing, customer phone/bill search, account receipt viewing, collections, price history, historic profit, Excel download, the nonempty-store seed guard, mobile overflow and synthetic low-contrast barcode decoding/camera cleanup. Physical camera and printer behavior still requires owner acceptance.

## Supplier purchase and calculator update — 12 October 2026

Supplier invoices now support up to 500 distinct product lines, quantities, unit costs and selling prices, with one payment and payable total. Duplicate additions in the form increase the existing quantity. Validation rejects invalid lines before stock changes; historic single-line purchases remain readable. Excel exports include separate invoice and purchase-item sheets.

The calculator displays steps and operand counts, shares keyboard/button logic, ignores repeated equals and prevents POS shortcuts from replacing the open dialog. It calculates left to right and rounds to two decimal places.

Validation: 31 automated tests passed; production build and TypeScript passed; all three browser suites passed, including multi-product saving/reloading and mixed keyboard/button calculations. npm audit reported zero vulnerabilities. Browser checks use sample mode; live owner acceptance and physical hardware checks above remain applicable.
