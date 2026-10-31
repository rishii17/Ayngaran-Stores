# CBL photographed purchase bill, printed 21 October 2026

The supplied four overlapping photographs contain 62 paid lines and two free Bubbles 30g packs. `cbl-2026-10-21.csv` is the reviewed transcription of the paid lines. The visible footer identifies CBL IT POS and a print time of 21-10-2026 17:04, but the legal supplier name, invoice number, payment status and additional discount percentage are not visible. No live database was accessed or seeded.

## Arithmetic confirmed from the photographs

| Item | LKR |
| --- | ---: |
| Chocolate/confectionery candidate group (1–49 and 62) | 49,617.00 |
| Cake paid lines (50–61) | 40,494.00 |
| Gross at printed purchase rates | 90,111.00 |
| Further printed CHOCOLATE discount | 1,795.05 |
| Final invoice net | 88,315.95 |

All printed purchase rates already equal MRP less **10% for the chocolate/confectionery lines** or **15% for the cake lines**. For example, MRP 50 → purchase rate 45; MRP 450 → cake purchase rate 382.50. Do not apply those percentages again to the printed rates. The further 1,795.05 deduction is separate. Its actual promotional percentage and eligible products cannot be determined from the images. Dividing it across *all* chocolate lines would produce an effective allocation rate of approximately 3.6178124433%; that is **not** a percentage printed on the bill.

## Manual SQL import

Use [`../../supabase/imports/cbl-2026-10-21.sql`](../../supabase/imports/cbl-2026-10-21.sql) in Supabase SQL Editor after the existing normalized-storage migration. This is an optional manual import, not a deployment migration. The owner selected proportional allocation across the chocolate/confectionery group and confirmed that the final amount was paid fully in cash to a new supplier. The owner UUID, new supplier label CBL, cash method and full paid amount are now prefilled. Review them before running the complete file.

Review the prefilled variables at the top:

- `v_owner`: prefilled as `656a5487-ee52-4920-b0be-140b68991f0e` from your uploaded table. Verify that this is the intended store owner's UUID in this Supabase project. It must be an existing, initialized normalized store.
- `v_supplier_id`: NULL to create a new supplier, as requested. `v_supplier_name` is prefilled as `CBL`, a label based on the receipt, not a verified legal company name. Change that label if your actual supplier uses a different name. A same-name supplier blocks duplicate creation and requires its existing ID instead. New supplier opening balance is zero.
- `v_paid`: prefilled as **88315.95**, the final net amount you confirmed was paid fully. The imported bill adds no outstanding payable. Do not import the bill again if it was already included in an existing purchase or supplier opening balance.
- `v_payment_method`: prefilled as `'cash'`, as confirmed. This records the historical invoice payment and does not move money in today's cash drawer.
- `v_discount_policy`: defaults to the owner-approved `'proportional_chocolate'` allocation across all chocolate/confectionery lines. Alternatively use `'confirmed_percentage'`, set `v_actual_percentage` to the real additional percentage, and set `v_discount_lines` to the eligible line numbers. That mode requires the chosen percentage/base to reproduce exactly the printed 1795.05 discount.

The owner confirmed proportional allocation across the chocolate/confectionery group. This allocation is not asserted as the supplier's actual promotional percentage. Both policies are implemented and locally tested. The confirmed-percentage test uses a synthetic arithmetic fixture, not evidence about this bill's promotion.

The approved final costs are listed in [`cbl-2026-10-21-net-costs.csv`](cbl-2026-10-21-net-costs.csv), including each allocated extra discount, received quantity, final unit cost and rounding adjustment. For example, Choco-La Milk 20g is Rs. 43.37 per pack; Bubbles 30g is Rs. 80.07 per received pack after sharing the paid cost across 26 packs. Cakes retain their printed rates.

After a successful run, refresh the store application and check Products, Inventory, the imported purchase and the supplier balance. No automatic deployment or live import is performed by saving these files.

## Imported records and rounding

The script inserts 62 new catalogue products with selling price set to printed MRP, no customer sale discount, no invented barcodes, the invoice's quantities as stock, one purchase with net total 88315.95, and 62 corresponding purchase stock movements. Import SKUs run **AYS-106 through AYS-167**, immediately after AYS-105. Your uploaded table uses AYS-105 for Sunsilk shampo pink 80ml, so the owner approved starting new products at AYS-106. Existing products/stock through AYS-105 remain unchanged. These are local catalogue identifiers, not manufacturer SKUs/barcodes. If any target SKU already exists (including a case variant), the import aborts atomically; it does not silently skip to a different numbering range. Invoice alias `PHOTO-CBL-20261021-88315.95` and purchase number `IMP-CBL-20261021` are explicitly import references, because the invoice header number is not visible.

The two free Bubbles 30g packs are merged with the 24 billed packs: 26 received units share the net cost of the 24 paid units. The source billed quantity, free quantity and pre-discount rate remain recorded in purchase metadata. Retail units follow PKT → pack, BOX → box (line 47), and BTL → bottle (line 49).

Largest-remainder allocation distributes the extra discount to cents, preserving the exact invoice net. Unit costs are rounded to two decimals for the application's existing cost fields. Exact effective unit costs and each line's `costRoundingAdjustment` remain in metadata, because a cent-rounded unit cost multiplied by a quantity may differ slightly from the exact invoiced line total. Purchase line totals retain the exact net allocations. VAT is included as printed and is not added again.

This imports historical received quantities as new stock; it cannot determine quantities already sold since the bill date. Review against current inventory first. Existing matching names or import SKUs cause the entire transaction to roll back; existing products are not silently merged, overwritten or restocked. An exact rerun is a no-op using an owner-scoped import request marker. If the earlier version of this bill import was already executed, this script does not rename or duplicate its products; an explicit SKU-only update would be a separate operation. All writes are owner-scoped and bump the store revision once.

## Transcription review

- Line 28's faded amount is reconstructed as 24 × 36 = **864.00**, which reconciles the printed gross. The print resembles `86 .00`.
- Line 32's small pack-size text is ambiguous in the photograph. The safe product name is **Choco-Mo 2DZ Pack**; verify its weight on the actual pack and rename if needed. Its quantity 6, MRP 250 and purchase rate 225 are clear. Metadata marks this label for review.
- Line 17 is partly cropped in one photograph but readable across the overlap: quantity 3 × rate 315 = 945.

Regenerate the embedded SQL after a reviewed CSV/template change with `python3 scripts/build-cbl-bill-import.py`. Validate using `npm run test:database`. No code or script here automatically connects to Supabase or executes the import.

Validation: 72 application tests and all 14 local database tests passed. Database tests cover both allocation modes, exact totals, free quantities, unit-cost rounding metadata, actual-paid/payable arithmetic, owner isolation, reruns, missing inputs and collision rollback. Tests use local fixtures; no live Supabase data was modified.
