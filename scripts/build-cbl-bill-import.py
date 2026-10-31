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
