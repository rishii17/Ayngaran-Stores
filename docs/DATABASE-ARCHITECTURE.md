# Relational storage upgrade

The UI and business workflow remain unchanged. Next.js serves the Express API; Express verifies the Supabase user, validates the action and applies the existing transaction rules. A repository adapter stores records in normalized PostgreSQL tables. The browser still receives the same state shape, including fractional quantities, English/Tamil names, camera/hardware scanning, credit, purchase lines, calculator, receipts and Excel backups.

## Tables

All names below have the `ayngaran_` prefix. Every business table is scoped by `owner_id` with row-level security and tenant-qualified foreign keys.

| Table | Purpose |
| --- | --- |
| stores | Owner, revision, storage version and untouched pre-upgrade JSON archive |
| settings | Shop identity, LKR currency, tax and receipt preferences |
| villages | Existing preset and custom village names |
| products | English/Tamil names, category, SKU, barcode, unit and current prices |
| product_images | Optional compressed WebP, separate from product/inventory rows |
| inventory | Current stock per product |
| customers | Customer details, village, opening credit and credit limit |
| suppliers | Supplier details and opening payable |
| sales | Bill header, totals, paid amount, method, customer/seller snapshot and void status |
| sale_items | Product/name/price/cost snapshots and measured quantity for each bill |
| purchases | Supplier invoice, total and amount paid |
| purchase_items | Products, quantities, costs and selling prices per purchase |
| payments | Subsequent customer collections and supplier payments |
| stock_movements | Opening stock, sales, receipts, adjustments and void movements |
| price_history | Previous/new cost and selling price with reason |
| held_bills | Unfinished billing drafts |
| held_bill_items | Items on each held draft |
| requests | Idempotency key, original result, time and action type |

The optional existing `seed_templates` table remains reference data only. There are 16 new business tables, in addition to the two original tables. `customer_balances`, `supplier_balances` and `daily_sales` are read-only reporting views, not extra copies of balances. Daily sales use Asia/Colombo dates and historical line costs for profit.

`extras` holds unrecognized legacy fields without hiding the primary business fields: names, references, quantities, prices, payment amounts and dates are typed columns. `seller` is intentionally a JSON receipt snapshot. `position` preserves the existing product and history order. IDs remain text to retain every existing identifier. Money and measured quantities use `numeric(20,2)`.

## Transaction and security behavior

- `ayngaran_load_v2` returns the existing API state shape from relational tables. It initializes a new owner's store and handles a legacy store once, under a row lock.
- Express calculates a row delta; `ayngaran_commit_v2` updates only changed rows, inserts financial lines/movements and removes completed/deleted held drafts in one transaction.
- The store revision lock prevents two stale counter requests from committing together. Express reloads and retries conflicts. Duplicate request IDs return their original result without repeating stock or credit changes.
- Existing records, receipt price/cost snapshots, opening balances, bill numbers and old idempotency keys are retained. Old single-item purchases become one purchase line with their original amounts.
- Foreign keys include owner identity, so a bill cannot point to another owner's customer/product. Indexes cover tenant keys, barcode/SKU lookup, dates, customer/supplier statements and product movements.
- New tables have owner RLS. Anonymous access is revoked. Functions and views use invoker rights; they do not bypass RLS or require a service-role key. The helper schema is not a PostgREST exposed schema.
- Authenticated owners have owner-scoped table permissions for the invoker transaction functions. Operational writes should use the application/RPC; manual table edits bypass the application's revision and ledger calculations. This retains the existing single-owner trust model, not a staff-permission system.
- Product photos stay compatible with the existing WebP upload field, stored in a separate table. Moving them to Supabase Storage with private URLs is a later optimization, not a prerequisite for this upgrade.

## Apply to the existing Ayngaran Stores project

Target project reference: **uoddttvmpqkojdwofcxr**. Do not run this on the older Grocery POS project.

1. Pull the updated code and run `npm ci`. This code can still operate against the old schema until migration; fallback is only allowed when the new RPC does not exist.
2. Download the app's full Excel backup and retain a database backup/snapshot. Stop all app instances/counters while running the migration.
3. In the target project's Supabase **SQL Editor**, run the **entire** file [`../supabase/migrations/20261012202125_normalize_store_records.sql`](../supabase/migrations/20261012202125_normalize_store_records.sql). It includes `BEGIN`/`COMMIT`, creates tables, migrates every existing owner and switches reads to relational records. Do not run selected fragments. It requires the existing `schema.sql` tables.
4. A new empty project must first run `supabase/schema.sql`, then the migration. Sample templates remain optional and are not automatically loaded into live stores.
5. Run [`../supabase/verify-relational.sql`](../supabase/verify-relational.sql) in SQL Editor. All store rows should be version 2; new tables should have RLS enabled, and public functions should not use definer rights. Review Supabase's Security Advisor too.
6. Restart with `npm run dev`, or `npm run build` and `npm start` in production. Sign in to the same owner account. Settings → Check live connection uses the v2 loader; `/api/connection` returns `storageVersion: 2` to an authenticated client.
7. Verify existing stock, customer/supplier balances and old receipts. Create a product, sell a fraction, accept partial payment, record a multi-item purchase, collect credit, print a bill and download the Excel backup.

There is no need to create a new account, re-enter products, reset keys or seed dummy data. The Supabase connection available to the coding workspace did not authorize access to this target project, so the migration has **not** been applied to your live database.

## Failure and recovery

The migration is transactional. Duplicate barcodes, broken references or invalid numeric data cause the whole upgrade to roll back instead of silently deleting records. Fix the specific source-data issue, then rerun the complete migration. It is rerunnable: already migrated stores are not re-imported from their archived JSON.

After a successful upgrade, `stores.state` is the preserved **pre-upgrade** archive, not the live store. Do not overwrite new tables from it after new sales occur. Older app versions are blocked from saving through the legacy commit function. Restart the updated version rather than rolling back the application alone.

For a full rollback before trading resumes, restore the pre-migration database backup and matching old application release together. After any new trading activity, take a current backup and reconcile those transactions before restoring an older backup. No destructive downgrade script is provided.

## Validation and remaining scaling work

`npm run test:database` executes the generated migration in an isolated PostgreSQL engine (PGlite), using test-only auth roles. It checks data preservation, all domain actions, image/name/history round trips, rollback, duplicate requests, revision conflicts, owner isolation, anonymous denial and repeat migration. It never creates Supabase accounts or changes cloud data. Run `npm test`, `npm run build` and `npm run typecheck` as well. CI runs the database tests.

The workflow-compatible API still loads the complete owner's state for the existing client, and serializes writes per owner. The normalized database enables future paginated reads and narrower server-side commands, but this release does not claim unlimited scale or multi-branch/staff support. Rate limits in a horizontally scaled host also need a shared external limiter before a high-volume rollout. Real Supabase load/concurrency testing and a live owner acceptance run remain required before production certification.

## Cash drawers and cash advances

Owner-scoped `stores.state_extras` retains `cashSessions`, `cashMovements` and `customerCredits`. They participate in the same atomic revision checks and idempotent request records as ordinary sales; no independent unguarded financial save is used. Existing-store data without these arrays reads as empty. The full-store API already preserves state extras. This keeps the current API contract, including complete JSON/Excel backups; it does not introduce transaction pagination or change the existing scaling limitations.

Apply `20261027090000_cash_credit_balances.sql` after normalization. It adds customer cash advances to the existing SQL receivable view, retains invoker security and owner isolation, and preserves prior bill/collection arithmetic. Fresh schema generation includes the same view formula. Cash advances are separate from sales/profit; repayments use ordinary payments. Cash/bank method fields on payments and purchases use existing row metadata. Closed drawer summaries freeze cash movements independently of later sale voids; actual cash refunds are explicit withdrawals.
