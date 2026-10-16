import test from "node:test";
import assert from "node:assert/strict";
import { purchaseComparisons } from "../lib/purchase-comparison.mjs";
const products = [
  {
    id: "a",
    name: "Alpha Chilli Powder 100g",
    tamil: "மிளகாய்",
    cost: 90,
    price: 120,
    unit: "pack",
  },
  {
    id: "b",
    name: "Beta Chilli Powder 100g",
    cost: 70,
    price: 100,
    unit: "pack",
  },
  { id: "c", name: "Rice", cost: 50, price: 60, unit: "kg" },
];
const suppliers = [
  { id: "s1", name: "Spice Company" },
  { id: "s2", name: "Wholesale Ltd" },
];
const purchases = [
  {
    supplierId: "s1",
    date: "2026-01-01",
    number: "OLD",
    productId: "a",
    cost: 80,
  },
  {
    supplierId: "s2",
    date: "2026-02-01",
    number: "OTHER",
    items: [{ productId: "a", cost: 85, unit: "pack" }],
  },
  {
    supplierId: "s1",
    date: "2026-03-01",
    number: "NEW",
    items: [{ productId: "a", cost: 90, unit: "pack" }],
  },
];
test("product search returns all brands and separate supplier costs, including catalogue-only products", () => {
  const rows = purchaseComparisons(
    products,
    suppliers,
    purchases,
    "CHILLI powder",
  );
  assert.equal(rows.length, 3);
  const alpha = rows.find((r) => r.supplierId === "s1");
  assert.equal(alpha.cost, 90);
  assert.equal(alpha.margin, 25);
  assert.deepEqual(
    alpha.history.map((h) => h.number),
    ["NEW", "OLD"],
  );
  assert.equal(rows.find((r) => r.product.id === "b").history.length, 0);
  assert.equal(products[0].cost, 90);
});
test("search supports company, mixed tokens, brand, Tamil and no matches", () => {
  assert.equal(
    purchaseComparisons(products, suppliers, purchases, "spice chilli").length,
    1,
  );
  assert.equal(
    purchaseComparisons(products, suppliers, purchases, "beta")[0].product.id,
    "b",
  );
  assert.equal(
    purchaseComparisons(products, suppliers, purchases, "மிளகாய்").length,
    2,
  );
  assert.equal(
    purchaseComparisons(products, suppliers, purchases, "missing").length,
    0,
  );
});
test("mismatched historical units and zero selling price do not show misleading margins", () => {
  const rows = purchaseComparisons(products, suppliers, [
    {
      supplierId: "s1",
      date: "2026-01-01",
      items: [{ productId: "a", cost: 10, unit: "kg" }],
    },
  ]);
  assert.equal(rows[0].margin, null);
  assert.equal(rows[0].unit, "kg");
  assert.equal(
    purchaseComparisons([{ ...products[0], price: 0 }], [], [])[0].margin,
    null,
  );
});
