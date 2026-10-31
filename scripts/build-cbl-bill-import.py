"""Build the reviewed, manual SQL import; never connects to a database."""
import csv
import json
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
rows = list(csv.DictReader((ROOT / "data/purchase-bills/cbl-2026-10-21.csv").open()))
assert [int(r["line"]) for r in rows] == list(range(1, 63))
assert sum(Decimal(r["printed_total"]) for r in rows) == Decimal("90111")
for r in rows:
    assert Decimal(r["quantity"]) * Decimal(r["invoice_rate"]) == Decimal(r["printed_total"])
    assert Decimal(r["invoice_rate"]) == Decimal(r["mrp"]) * (Decimal("0.90") if r["group"] == "chocolate" else Decimal("0.85"))
payload = [{"line": int(r["line"]), "name": r["name"], "mrp": r["mrp"], "billed_quantity": r["quantity"], "rate": r["invoice_rate"], "gross": r["printed_total"], "group_name": r["group"]} for r in rows]
template = (ROOT / "data/purchase-bills/cbl-import-template.sql").read_text()
result = template.replace("__BILL_JSON__", json.dumps(payload, ensure_ascii=False, indent=2).replace("'", "''"))
(ROOT / "supabase/imports/cbl-2026-10-21.sql").write_text(result)
print("Generated manual SQL for 62 paid lines plus 2 free Bubbles 30g packs.")

# Owner-confirmed allocation review: mirror PostgreSQL positive numeric rounding.
from decimal import ROUND_FLOOR, ROUND_HALF_UP
D = Decimal
eligible = [r for r in rows if r["group"] == "chocolate"]
base = sum(D(r["printed_total"]) for r in eligible)
raw_cents = {int(r["line"]): D("179505") * D(r["printed_total"]) / base for r in eligible}
allocated_cents = {line: amount.to_integral_value(rounding=ROUND_FLOOR) for line, amount in raw_cents.items()}
remaining = int(D("179505") - sum(allocated_cents.values()))
ranked = sorted(raw_cents, key=lambda line: (-(raw_cents[line] - allocated_cents[line]), line))
for line in ranked[:remaining]:
    allocated_cents[line] += 1
review = []
for r in rows:
    line = int(r["line"])
    free = 2 if line == 21 else 0
    received = D(r["quantity"]) + free
    discount = allocated_cents.get(line, D(0)) / 100
    net = D(r["printed_total"]) - discount
    cost = (net / received).quantize(D("0.01"), rounding=ROUND_HALF_UP)
    adjustment = net - (cost * received).quantize(D("0.01"), rounding=ROUND_HALF_UP)
    review.append({"line": line, "sku": f"AYS-{110 + line:03d}", "name": r["name"], "mrp": r["mrp"], "base_discount_percent": 10 if r["group"] == "chocolate" else 15,
                   "printed_purchase_rate": r["invoice_rate"], "billed_quantity": r["quantity"], "free_quantity": free,
                   "received_quantity": str(received), "allocated_extra_discount": f"{discount:.2f}", "net_line_total": f"{net:.2f}",
                   "final_unit_purchase_cost": f"{cost:.2f}", "cost_rounding_adjustment": f"{adjustment:.2f}"})
assert sum(D(r["allocated_extra_discount"]) for r in review) == D("1795.05")
assert sum(D(r["net_line_total"]) for r in review) == D("88315.95")
with (ROOT / "data/purchase-bills/cbl-2026-10-21-net-costs.csv").open("w", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=review[0].keys(), lineterminator="\n")
    writer.writeheader()
    writer.writerows(review)
print("Generated owner-approved net-cost review CSV; final invoice total 88315.95.")
