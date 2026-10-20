# Manual web deployment

Use the latest `main` branch of `rishii17/Ayngaran-Stores` on a Node.js 22+ host that supports Next.js API routes. Use HTTPS. This application is not a static export: Next.js runs the Express API inside the same service. Do not start a second Express process.

## Hosting configuration

Set these in the host's environment settings **before building**, and retain them at runtime:

- `NEXT_PUBLIC_SUPABASE_URL`: your Ayngaran Stores project URL (`https://uoddttvmpqkojdwofcxr.supabase.co`).
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the active publishable key from that same project's Supabase Settings → API Keys. Never use a secret/service-role key.
- `NEXT_PUBLIC_ENABLE_SAMPLE_MODE=false` (or leave unset). Public releases open live mode and do not load browser sample products or expose sample import buttons. Changing this public setting requires a rebuild.

The host supplies its normal `PORT`. Build and start commands:

```bash
npm ci
npm run check:env
npm run build
npm start
```

On managed Next.js hosting, use the provider's normal Next.js runtime. Do not upload the local `.next` testing directory; let the host build from GitHub using its own environment variables. `npm run check:env` must pass before publishing. A build without keys can render the sign-in page, but cannot sign in or save store records.

Supabase must contain the schema, owner policies and RPCs documented in `DATABASE-ARCHITECTURE.md`. Inspect the current database before applying migrations; deploying this code does not migrate or delete database records. Enable email/password authentication and configure Supabase Auth's Site URL and allowed redirect URLs for your HTTPS website.

## Website acceptance

After deployment:

1. Request `/api/health`: expect JSON `ok: true` and `configured: true`.
2. Request `/api/state` while signed out: expect JSON HTTP 401, never an HTML 404 page.
3. Sign in with a real authorized owner. New owner stores are empty. Settings → Check live connection must confirm an authenticated database connection.
4. Verify customer sorting, a real-owner test purchase and checkout, stock/credit balances, reload persistence and an Excel backup in an appropriate test owner account.
5. Verify the physical scanner, camera permissions and receipt printer on the intended hardware.

Sample records previously saved in browser storage are ignored by the production view. Existing live records are preserved. No live data cleanup is performed automatically.

## Reproducing local checks

```bash
npm test
npm run test:database
npm run audit:security
```

The full transaction/browser regression suite uses isolated sample fixtures. In one terminal:

```bash
NEXT_PUBLIC_ENABLE_SAMPLE_MODE=true npm run build
NEXT_PUBLIC_ENABLE_SAMPLE_MODE=true npm start
```

In another terminal:

```bash
npm run test:browser
```

This runs all twelve browser scripts, including product deletion, customer sorting, partial payments, scanning and viewport checks. Set `POS_TEST_URL` if the service uses a different local origin.

For the production view, stop the test service, unset/disable sample mode, rebuild with your hosting configuration, start again, then run `npm run test:production`. Its default smoke check verifies sign-in, no sample products or loaders, preserved old browser sample backups, response headers and unauthenticated API denial. The optional `PRODUCTION_TEST_SUPABASE_URL` test setting enables mocked session restoration and customer sorting against an isolated public test project URL; it is not a live database test.

This release was checked with Node.js 24.19.0 and system Chromium. The local security review and dependency audit do not verify your hosting configuration or a live Supabase account. Real-owner checkout, production concurrency, and hardware acceptance must be completed on the deployed environment.

## Login-only access and administrator-created accounts

The public page contains only sign-in. It has no registration form, and the store interface is hidden while signed out. To block direct registration requests as well, open the Supabase dashboard → Authentication → Sign In / Providers and turn off **Allow new users to sign up**. Hiding the website registration form alone cannot change Supabase's public Auth settings. `npm run check:auth` now also checks that public sign-ups are disabled.

Create the first administrator account manually in Supabase Authentication → Users (or use your existing owner). In the hosting environment set:

- `AYNGARAN_ADMIN_USER_IDS`: that administrator's Supabase user UUID. For multiple trusted administrators, separate UUIDs with commas. This is checked by the server after verifying their login; account metadata cannot grant this permission.
- `SUPABASE_SECRET_KEY`: the project's Supabase secret key, or its legacy service-role key, stored as a **server-only hosting secret**. Never prefix this variable with `NEXT_PUBLIC_`, put it in browser code, or commit a real value. The public `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` remains the publishable key.

Restart/redeploy the Node service after changing these server settings. Sign in as the administrator and open **Settings → Create user**. Enter a name, email and initial password (at least 12 characters), then share the credentials privately with that person. Administrator-created accounts are confirmed by this trusted action, so no public signup or signup email is required. The signed-in administrator's session is preserved.

New accounts have separate stores, matching the existing ownership model. They do not receive administrator permissions. Only a hosting administrator can add their UUID to the administrator list. Keep at least one trusted administrator account available; ordinary users cannot create users. If the secret key is absent, the administration form is disabled; all normal store functions continue to use the caller's publishable key/JWT and owner isolation.

The hydration warning reported with `__processed_…` and `bis_skin_checked` comes from extension-added attributes. The body and initial loading placeholder explicitly tolerate these attribute changes. Next.js also creates a hidden metadata div outside application JSX: a small before-hydration script removes only `bis_skin_checked` from hidden divs, leaving metadata and the `hidden` attribute intact. Its observer stops when the app mounts (with a ten-second fallback), so it does not monitor application DOM changes permanently. Application data hydration checks remain enabled. Test in a private browser window if an extension continues modifying deeper application markup.

## Product deletion release

Deploy the latest `main` commit with the same live-mode settings. No new migration or environment variable is required for product deletion; it updates the existing product's active state and stores the deletion timestamp in its existing metadata. In a suitable owner test account, confirm deletion removes the product from the selling catalogue and new purchases, preserves prior receipts/history and stock value, and survives a reload. Remaining stock is visible in Inventory with a Deleted status. SKU/barcode identifiers remain reserved. Do not purge historical product rows directly from the database because transactions reference them.
