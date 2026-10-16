import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import catalog from "../data/supplier-sample-products.json" with { type: "json" };
import {
  addSupplierSample,
  supplierSampleCount,
} from "../lib/supplier-sample.mjs";
import { seedState, applyAction, supplierBalance } from "../lib/domain.mjs";
import { purchaseComparisons } from "../lib/purchase-comparison.mjs";

test("all source price lines are retained, brands expanded, and ambiguous prices flagged", () => {
  const lines = readFileSync(
    new URL("../data/supplier-sample-source.txt", import.meta.url),
    "utf8",
  )
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\(\s*\d/.test(line));
  assert.equal(lines.length, 173);
  for (const line of lines)
    assert.ok(
      catalog.some((p) => p.sourceQuote === line),
      line,
    );
  assert.equal(supplierSampleCount, 184);
  assert.equal(new Set(catalog.map((p) => p.id)).size, catalog.length);
  assert.equal(catalog.filter((p) => p.price === null).length, 2);
  assert.ok(
    catalog.find((p) => p.name === "Soorya Matches").note.includes("inferred"),
  );
  assert.equal(catalog.find((p) => p.name === "Coca-Cola 250ml").cost, 98);
  assert.equal(catalog.find((p) => p.name === "Sprite 250ml").price, 120);
});

test("import appends once, preserves work, and creates balanced test stock and sample purchase", () => {
  const original = seedState();
  original.products[0].name = "Existing edited product";
  const snapshot = structuredClone(original);
  const { state, added } = addSupplierSample(original, "demo");
  assert.equal(added, 184);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(state.products.slice(0, 16), original.products);
  assert.deepEqual(state.customers, original.customers);
  assert.equal(state.purchases.length, 1);
  assert.match(state.purchases[0].reference, /SAMPLE ONLY/);
  assert.equal(state.purchases[0].items.length, 182);
  assert.equal(state.movements.length, 182);
  assert.equal(supplierBalance(state, state.purchases[0].supplierId), 0);
  for (const p of state.products.slice(16))
    assert.equal(p.stock, p.active ? 12 : 0);
  assert.equal(addSupplierSample(state, "demo").added, 0);
  assert.deepEqual(addSupplierSample(state, "demo").state, state);
  const coca = state.products.find((p) => p.name.startsWith("Coca-Cola 250ml"));
  const sold = applyAction(state, {
    type: "checkout",
    payload: {
      items: [{ productId: coca.id, quantity: 1 }],
      discount: 0,
      method: "cash",
      tendered: 120,
    },
  });
  assert.equal(sold.state.products.find((p) => p.id === coca.id).stock, 11);
  assert.equal(
    purchaseComparisons(
      state.products,
      state.suppliers,
      state.purchases,
      "toothpaste",
    ).length,
    12,
  );
  assert.equal(
    purchaseComparisons(
      state.products,
      state.suppliers,
      state.purchases,
      "කොකාකෝලා",
    ).length,
    10,
  );
});

test("live mode and collisions cannot overwrite user records", () => {
  const state = seedState();
  assert.throws(() => addSupplierSample(state, "live"), /sample mode/);
  state.products[0].sku = "SAMPLE-LIST-001";
  const before = structuredClone(state);
  assert.throws(() => addSupplierSample(state, "demo"), /already exist/);
  assert.deepEqual(state, before);
});
