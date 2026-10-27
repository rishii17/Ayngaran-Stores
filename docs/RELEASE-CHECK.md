# Product discounts and transparent billing — 27 October 2026

Products support a saved fixed LKR discount per unit or a percentage of the original selling price. POS defaults apply on addition; each bill line can override them without editing the product. Repeated scans retain the selected discount. Cards and bill lines show original/discounted unit prices; original subtotal, product savings, additional bill discount, total discounts and final payable amount are shown in the bill and printed receipt. Unit discounts round to cents before quantity-based line discounts round to cents. Tax applies after all discounts.

Server actions validate discount types, precision and limits, recompute prices/costs from the owner’s product catalogue, and reject conflicting duplicate-line discounts. Checkout stores original prices/costs and discount snapshots. The existing sale discount column stores combined savings, so existing profit and SQL reports continue subtracting all discounts once. Held bills retain their selected discounts; legacy holds retain zero product discounts. Additional bill discounts are capped to the remaining payable subtotal. Product edits, price changes, purchases, credit balances, stock movements and voiding retain their existing rules. Excel exports include original prices, line discounts and final amounts.

The new product, sale and item fields round-trip through existing normalized JSON metadata; no database migration or new environment variables are required. Existing receipts retain their previous figures. Production remains login-only with sample mode disabled.

Validation passed: 58 application/security/API tests, 6 database tests, all 14 browser scripts, the final production build, TypeScript and production login/hydration checks. The dedicated discount browser test also checks small-screen checkout, legacy holds, receipt/reload and bill-discount capping. Dependency audit: zero known vulnerabilities. API/database tests use local fixtures; no live Supabase records were changed and no deployment was performed.

# Mobile product photos and POS camera scanning — 26 October 2026

Add/Edit Product includes **Take photo**, which requests the rear camera through the phone’s native image capture picker, plus a separate existing-photo chooser. Both use the same 600-pixel WebP optimization and validation. Saving is blocked during processing, file inputs reset for retry, and closing the form prevents late photo results from changing another form.

POS Scan explicitly identifies barcode and QR support. Automated mobile camera streams exercise EAN-8, UPC-A, Code128 (including rotated bars) and QR containing a saved SKU. Successful scans add one unit, select bill quantity and stop camera tracks. Rescanning increments quantity; insufficient stock keeps the bill unchanged and displays the stock warning instead of a false success notification. Permission denial retains an actionable message and manual code entry.

Security checks identified advisories in existing dependencies. Applied compatible patches: Next 16.4.3, Zod 4.6.7, body-parser 2.4.0 and ip-address 10.7.5; the lockfile records these updates. The dependency audit now reports zero known vulnerabilities.

Validation passed: 52 application/security tests, 5 database tests, all 13 browser scripts, production build, TypeScript and production login/hydration checks. Production was built with sample mode disabled.

Camera validation uses Chromium mobile emulation and generated camera streams, plus an image file supplied to the native capture input. Physical Android/iPhone camera behavior, lens focus and permission prompts still need a check on the manually deployed HTTPS website. No live store data or deployment was changed; existing Supabase settings remain required.

# Inventory closure before deletion — 20 October 2026

Products can be deleted from Products or Inventory only when stock is exactly zero. The same rule runs in the server action, so stale clients cannot delete a product that has been restocked. Sell remaining stock or record a reasoned Inventory adjustment first. The confirmation shows remaining stock and disables deletion until inventory is closed; current and held bill checks still apply. Past bills, purchase history and the product’s inventory record remain intact. Voiding an old sale can still return stock to a deleted product without reactivating it. Previously deleted records are preserved.

Validation: 52 application/security tests, 5 database tests and all 12 browser scripts passed. Production build, TypeScript, production login/hydration checks and dependency audit (zero known vulnerabilities) also passed. Coverage includes nonzero/fractional stock rejection, recorded closure, deletion from Inventory, historical preservation and reload persistence. No migration or environment change is required.

# Product deletion release — 20 October 2026

Products now have a Delete action with a typed DELETE confirmation and cancellation. Deletion removes an item from the selling catalogue, scanner matches and new purchases. Referenced product rows, transaction snapshots and stock quantities remain intact; remaining stock is visible in Inventory with a Deleted status. Current/held bill safeguards prevent accidental removal of an in-progress line. Stale edits, price updates, checkout, purchases and new holds cannot reactivate or use a deleted product. Old sale voids and inventory adjustments remain available.

The change uses existing owner-scoped updates and metadata, so no additional database migration or permission is required. Test coverage includes repeat deletion, confirmation validation, held/current bills, historical integrity, database round-trip/foreign keys, sale voids, scanner/purchase exclusion and browser reloads. Validation: 51 application/security tests, 5 database tests and all 12 browser scripts passed; production build/type checks and login/hydration checks passed; dependency audit reported zero vulnerabilities. Public releases retain login-only access with sample mode disabled. Follow [Deployment](DEPLOYMENT.md) for manual deployment and the existing Supabase/user-administration settings.

---

# Hidden metadata hydration regression — 20 October 2026

The reported `<__next_metadata_boundary__><div hidden bis_skin_checked="1">` mismatch is caused by an extension annotating a Next-owned div. The previous body/loading suppression could not cover this nested framework element. A `beforeInteractive` script now removes only that extension attribute from hidden divs before React hydration. It leaves the wrapper, metadata and application attributes intact and disconnects on app mount, with a ten-second fallback.

The browser regression now annotates the actual server-rendered metadata wrapper, reproduces the original failure without this cleanup, and verifies warning-free hydration in development and production. It also checks that the cleanup stops after hydration and metadata remains present. Application/security tests, production checks, build and TypeScript pass. No business functions or login/admin permissions changed.

---

# Login-only access and hydration fix — 20 October 2026

- The public production page now contains only email/password sign-in. The application interface is not rendered while signed out, and registration controls/API signup calls were removed from the client.
- Settings → Create user is available only to server-configured administrators. Requests verify the caller with Supabase before checking `AYNGARAN_ADMIN_USER_IDS`. Creation uses the server-only `SUPABASE_SECRET_KEY`, cannot grant administrator permissions, returns only account ID/email, and is limited to 10 attempts per hour per administrator. New accounts keep separate stores and creation preserves the current administrator session.
- Extension-added body and initial-loading attributes are tolerated at those specific hydration boundaries. The reported `__processed_…` / `bis_skin_checked` mutation was reproduced without a hydration warning in Next development mode and production. Application hydration checks remain enabled elsewhere.
- Local development explicitly allows `localhost` and `127.0.0.1`, resolving Next.js's blocked dev-resource origin when using loopback IP URLs.

Validation: 49 application/security tests, 4 isolated database tests, the 11 browser regression scripts, production login/admin-creation tests, development/production hydration regression checks, build and TypeScript. Dependency audit: zero known vulnerabilities. Account creation and authentication checks use isolated API fixtures, not live project credentials.

Deployment must disable Supabase's **Allow new users to sign up** setting and configure the administrator UUID(s) and server-only secret. The first administrator must already exist (or be created in Supabase's dashboard). `npm run check:auth` now verifies that public signup is disabled. These hosted settings and live account creation cannot be verified from this workspace without the project's credentials. Follow [Deployment](DEPLOYMENT.md#login-only-access-and-administrator-created-accounts).

---

# Manual web release — 20 October 2026

Current release instructions: [Deployment](DEPLOYMENT.md).

- Added customer sorting by name in both directions, village, outstanding balance in both directions, and highest credit limit. Sorting applies to search results without changing customer records or balances.
- Public builds default to live sign-in. They show no sample products or sample import buttons and ignore old demo browser storage. Stored browser demo backups and existing live records are preserved. Live API sample import is blocked by default.
- Camera scanner code and the optional supplier sample catalogue load on demand. Existing billing, supplier comparisons, purchases, credit, reporting and backups retain their workflows.
- Fixed malformed/oversized JSON responses, sign-out error handling, and the misleading signed-out connection label. Removed the framework disclosure header and added HTTPS transport security.

Validation completed in this workspace:

- **48 application/security tests passed**, zero failures or skips.
- **4 database tests passed** in isolated PostgreSQL/PGlite: owner isolation, anonymous denial, migration/rollback and transaction round-trips.
- **All 11 browser regression scripts passed**, including customer sorting, partial payments, scanner formats, supplier comparisons, persistence, and seven billing viewport sizes.
- Production build and TypeScript passed. Separate production browser checks passed for no samples, ignored demo storage, unauthenticated API denial, and session restoration, customer sorting, sign-out error handling and session cleanup with explicitly mocked authentication/API fixtures.
- Dependency audit: **0 known vulnerabilities**. Local security tests cover authentication requirements, sample-import blocking, request limits, malformed JSON handling, and rate limiting. A source secret-pattern scan found only the existing deliberately fake key in the environment-validation test; no real credential match was found by those patterns.

The user will deploy manually. Real Supabase variables are absent from this machine; `npm run check:env` correctly reports the two missing public configuration values. Authentication/session browser tests used isolated fixtures, not a live owner account. Live-owner checkout, live database concurrency, hosting setup, and physical scanner/printer checks remain for deployment acceptance. No live data was deleted, and no website deployment was performed here.

---

## Historical release notes

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

## Restore normal app and hardware scanner workflow

Removed the separate mobile-scanner page, pairing server/routes, phone components, install manifest/icons, mobile diagnostics and local HTTPS scripts. Normal startup is `npm run dev` at `http://localhost:3000`.

POS and supplier purchases now have a dedicated Hardware scanner input. Keyboard/HID scanner output terminated by Enter adds one unit, retains focus and reports unknown codes without fuzzy matching or submitting a bill/purchase. USB keyboard scanners and Ethernet devices with vendor keyboard-output software are supported by this input; direct TCP/UDP Ethernet scanner protocols require a model-specific integration and are not claimed as implemented.

Verified: 33 automated tests, production build, TypeScript and five browser suites passed. Tests include repeated hardware-style scans, UPC/EAN equivalence, unknown-code rejection, focus retention, multi-product purchase saving, camera formats, calculator controls and HTTP 404 for the removed phone page/manifest. Physical scanner verification remains pending until a device is selected. No live store records were changed. Existing local certificate files remain ignored and were not deleted.

## Camera decoder error handling — 13 October 2026

Replaced the library's noisy MultiFormatReader/browser luminance path with explicit format readers over grayscale pixel data. Expected no-match/checksum/format failures continue to the next reader without logging every frame; unexpected processing failures stop the camera and show an error. Rotation remains in the app's explicit canvas path, avoiding the library's failing internal canvas allocation. Hardware keyboard entry is unchanged.

Verified production build/type checking; idle camera without repeated MultiFormatReader/canvas warnings; low-contrast EAN-13, EAN-8, UPC-A, Code128, rotated Code128 and QR camera fixtures; hardware-scanner regression. The idle-camera/EAN-13 test also passed against Next development mode.

## Normalized database architecture — 13 October 2026

Added 16 typed business tables, owner-qualified foreign keys, financial and stock constraints, owner RLS, indexes, and customer/supplier balance and Sri Lanka daily-sales views. The repository adapter keeps the current UI/API state shape while the v2 commit RPC writes only changed rows atomically. Legacy records and request IDs are migrated, with the original store JSON retained as a pre-upgrade archive. Old commit calls are blocked after migration; the new app falls back only for an unmigrated database with a missing v2 RPC.

Validation: migration and all existing transaction types tested in isolated PostgreSQL/PGlite, including rollback, owner isolation, anonymous denial, repeated migration, legacy single-line purchases, retained snapshots/custom fields, partial payments, voids and reporting balances. Domain/API/repository tests, production build, TypeScript and all six browser regression scripts passed. Dependency audit: zero vulnerabilities.

Live status: Supabase project `uoddttvmpqkojdwofcxr` denied this connection access. No live migration or live security-advisor run was performed. Apply the tested migration using the [database architecture guide](DATABASE-ARCHITECTURE.md), then complete signed-in acceptance checks. Existing screen flows were not changed.
