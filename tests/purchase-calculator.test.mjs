import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, seedState, supplierBalance } from "../lib/domain.mjs";
import { calculate, initialCalculator } from "../lib/calculator.mjs";
import { createBackup } from "../lib/backup.mjs";
import ExcelJS from "exceljs";
const run = (keys) => keys.reduce(calculate, initialCalculator());
test("calculator clicks and keyboard aliases agree, with counts and visible steps", () => {
  const a = run(["1", "2", "+", "3", "Enter", "*", "2", "="]);
  const b = run(["1", "2", "+", "3", "=", "×", "2", "="]);
  assert.deepEqual(a, b);
  assert.equal(a.display, "30");
  assert.equal(a.count, 3);
  assert.deepEqual(a.history, ["12 + 3 = 15", "15 × 2 = 30"]);
  assert.deepEqual(calculate(a, "Enter"), a);
  assert.equal(run(["2", "+", "*", "3", "="]).display, "6");
  assert.equal(
    run(["1", ".", ".", "5", "Backspace", "2", "+", "0", ".", "3", "="])
      .display,
    "1.5",
  );
  assert.equal(run(["2", "/", "0", "="]).display, "Error");
  assert.equal(run(["2", "/", "0", "=", "4"]).display, "4");
  assert.deepEqual(calculate(a, "Delete"), initialCalculator());
});
test("multi-product purchase records one payable, updates stock and both prices, preserves old sales", async () => {
  const s = seedState();
  const old = structuredClone(s);
  const payload = {
    supplierId: s.suppliers[0].id,
    paid: 100,
    reference: "INV-2",
    items: [
      {
        productId: s.products[0].id,
        quantity: 2,
        cost: 200,
        sellingPrice: 260,
      },
      {
        productId: s.products[1].id,
        quantity: 3,
        cost: 180,
        sellingPrice: 250,
      },
    ],
  };
  const { state, result } = applyAction(s, { type: "purchase", payload });
  assert.equal(result.total, 940);
  assert.equal(result.items.length, 2);
  assert.equal(state.purchases.length, s.purchases.length + 1);
  assert.equal(
    supplierBalance(state, payload.supplierId) -
      supplierBalance(s, payload.supplierId),
    840,
  );
  assert.equal(state.products[0].stock, s.products[0].stock + 2);
  assert.equal(state.products[1].price, 250);
  assert.equal(state.priceHistory.length, 2);
  assert.deepEqual(s, old);
  assert.deepEqual(state.sales, s.sales);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await createBackup(state, "2026-10-11", "demo"));
  assert.equal(workbook.getWorksheet("Purchase items").rowCount, 3);
  assert.equal(
    workbook.getWorksheet("All purchases").getRow(2).getCell(5).value,
    940,
  );
  for (const items of [
    [payload.items[0], payload.items[0]],
    [payload.items[0], { ...payload.items[1], sellingPrice: 0 }],
    [payload.items[0], { ...payload.items[1], productId: "missing" }],
    [],
  ]) {
    assert.throws(() =>
      applyAction(s, { type: "purchase", payload: { ...payload, items } }),
    );
    assert.deepEqual(s, old);
  }
  assert.throws(() =>
    applyAction(s, { type: "purchase", payload: { ...payload, paid: 941 } }),
  );
});
