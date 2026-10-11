import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAction,
  seedState,
  customerBalance,
  supplierBalance,
  totals,
} from "../lib/domain.mjs";
const bill = (s, overrides = {}) => ({
  type: "checkout",
  payload: {
    items: [{ productId: s.products[0].id, quantity: 2 }],
    method: "cash",
    tendered: 500,
    discount: 0,
    ...overrides,
  },
});
test("cash checkout rounds totals, deducts stock and records traceable movement", () => {
  const s = seedState();
  const { state, result } = applyAction(s, bill(s));
  assert.equal(result.total, 480);
  assert.equal(result.change, 20);
  assert.equal(state.products[0].stock, 123);
  assert.equal(s.products[0].stock, 125);
  assert.equal(state.movements[0].reference, result.number);
});
test("overselling fails atomically including duplicated product lines", () => {
  const s = seedState();
  assert.throws(
    () =>
      applyAction(
        s,
        bill(s, {
          items: [
            { productId: s.products[0].id, quantity: 100 },
            { productId: s.products[0].id, quantity: 100 },
          ],
          tendered: 99999,
        }),
      ),
    /Only 125/,
  );
  assert.equal(s.sales.length, 0);
  assert.equal(s.products[0].stock, 125);
});
test("fractional weighed products and discount/tax calculate correctly", () => {
  const s = seedState();
  s.settings.taxRate = 18;
  const { result } = applyAction(
    s,
    bill(s, {
      items: [{ productId: s.products[0].id, quantity: 1.25 }],
      discount: 20,
    }),
  );
  assert.equal(result.subtotal, 300);
  assert.equal(result.tax, 50.4);
  assert.equal(result.total, 330.4);
  assert.equal(result.change, 169.6);
});
test("short cash, negative quantity and excessive discounts are rejected", () => {
  const s = seedState();
  assert.throws(() => applyAction(s, bill(s, { tendered: 100 })), /less than/);
  assert.throws(
    () =>
      applyAction(
        s,
        bill(s, { items: [{ productId: s.products[0].id, quantity: -1 }] }),
      ),
    /positive/,
  );
  assert.throws(() => applyAction(s, bill(s, { discount: 1000 })), /exceeds/);
});
test("credit needs a customer and respects credit limits", () => {
  const s = seedState();
  assert.throws(
    () => applyAction(s, bill(s, { method: "credit", tendered: 0 })),
    /Select a customer/,
  );
  s.customers[0].creditLimit = 2500;
  assert.throws(
    () =>
      applyAction(
        s,
        bill(s, {
          method: "credit",
          tendered: 0,
          customerId: s.customers[0].id,
        }),
      ),
    /credit limit/,
  );
});
test("credit partial payment and collections update the correct ledger", () => {
  const s = seedState(),
    id = s.customers[0].id;
  const { state } = applyAction(
    s,
    bill(s, { method: "credit", tendered: 80, customerId: id }),
  );
  assert.equal(customerBalance(state, id), 2800);
  const next = applyAction(state, {
    type: "payment",
    payload: { customerId: id, amount: 500 },
  });
  assert.equal(customerBalance(next.state, id), 2300);
  assert.throws(
    () =>
      applyAction(next.state, {
        type: "payment",
        payload: { customerId: id, amount: 5000 },
      }),
    /exceeds/,
  );
});
test("purchase adds stock, changes cost and tracks supplier payable", () => {
  const s = seedState(),
    supplierId = s.suppliers[0].id;
  const { state } = applyAction(s, {
    type: "purchase",
    payload: {
      supplierId,
      productId: s.products[0].id,
      quantity: 10,
      cost: 200,
      paid: 500,
      reference: "INV-17",
    },
  });
  assert.equal(state.products[0].stock, 135);
  assert.equal(state.products[0].cost, 200);
  assert.equal(supplierBalance(state, supplierId), 1500);
  const next = applyAction(state, {
    type: "payment",
    payload: { supplierId, amount: 500 },
  });
  assert.equal(supplierBalance(next.state, supplierId), 1000);
});
test("void restores stock exactly once and removes credit", () => {
  const s = seedState(),
    customerId = s.customers[0].id;
  const { state, result } = applyAction(
    s,
    bill(s, { method: "credit", tendered: 0, customerId }),
  );
  const next = applyAction(state, {
    type: "void",
    payload: { id: result.id, reason: "Incorrect bill" },
  });
  assert.equal(next.state.products[0].stock, 125);
  assert.equal(customerBalance(next.state, customerId), 2400);
  assert.throws(
    () =>
      applyAction(next.state, {
        type: "void",
        payload: { id: result.id, reason: "Again" },
      }),
    /already void/,
  );
});
test("cannot void credit already collected without a refund workflow", () => {
  const s = seedState(),
    customerId = s.customers[1].id;
  const sold = applyAction(
    s,
    bill(s, { method: "credit", tendered: 0, customerId }),
  );
  const paid = applyAction(sold.state, {
    type: "payment",
    payload: { customerId, amount: 480 },
  });
  assert.throws(
    () =>
      applyAction(paid.state, {
        type: "void",
        payload: { id: sold.result.id, reason: "Return" },
      }),
    /Refund credit/,
  );
});
test("stock adjustment requires a reason and cannot make stock negative", () => {
  const s = seedState();
  assert.throws(
    () =>
      applyAction(s, {
        type: "adjust",
        payload: {
          productId: s.products[0].id,
          quantity: -200,
          reason: "Count",
        },
      }),
    /negative/,
  );
  assert.throws(
    () =>
      applyAction(s, {
        type: "adjust",
        payload: { productId: s.products[0].id, quantity: 2, reason: "" },
      }),
    /reason/,
  );
});
test("product updates cannot bypass the stock movement ledger", () => {
  const s = seedState();
  const { state } = applyAction(s, {
    type: "product",
    payload: { ...s.products[0], stock: 999 },
  });
  assert.equal(state.products[0].stock, 125);
});
test("duplicate barcode and SKU are rejected", () => {
  const s = seedState();
  assert.throws(
    () =>
      applyAction(s, {
        type: "product",
        payload: { ...s.products[0], id: undefined },
      }),
    /already exists/,
  );
});
test("held bill is removed only after completed checkout", () => {
  const s = seedState();
  const held = applyAction(s, {
    type: "hold",
    payload: { items: bill(s).payload.items, label: "Test", discount: 0 },
  });
  const result = applyAction(
    held.state,
    bill(held.state, { heldId: held.state.held[0].id }),
  );
  assert.equal(result.state.held.length, 0);
});
test("zero tax default and decimal rounding", () => {
  assert.deepEqual(totals([{ price: 0.1, quantity: 3 }], 0, 0), {
    subtotal: 0.3,
    discount: 0,
    tax: 0,
    total: 0.3,
  });
});

test("rejects sub-cent prices and excess precision in stock changes", () => {
  const s = seedState();
  assert.throws(
    () =>
      applyAction(s, {
        type: "product",
        payload: { ...s.products[0], price: 0.001 },
      }),
    /two decimal/,
  );
  assert.throws(
    () =>
      applyAction(s, {
        type: "adjust",
        payload: {
          productId: s.products[0].id,
          quantity: 0.001,
          reason: "Count",
        },
      }),
    /two decimal/,
  );
});
test("receipt retains seller details after settings change", () => {
  const s = seedState();
  const sold = applyAction(s, bill(s));
  const changed = applyAction(sold.state, {
    type: "settings",
    payload: { ...s.settings, name: "New name" },
  });
  assert.equal(changed.state.sales[0].seller.name, "Ayngaran Stores");
});

test("subtotal agrees with rounded receipt line amounts", () => {
  assert.equal(
    totals([
      { price: 0.01, quantity: 0.5 },
      { price: 0.01, quantity: 0.5 },
    ]).total,
    0.02,
  );
});
