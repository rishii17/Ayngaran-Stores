import test from "node:test";
import assert from "node:assert/strict";
import { seedState, applyAction } from "../lib/domain.mjs";
import {
  relationalChanges,
  relationalRows,
} from "../server/relational-model.mjs";
import { findProductByCode } from "../lib/product-code.mjs";
const remove = (state, id) =>
  applyAction(state, {
    type: "deleteProduct",
    payload: { productId: id, confirm: "DELETE" },
  });
test("product deletion preserves historical transactions and stock while preventing new sales/purchases", () => {
  let state = seedState();
  const id = state.products[0].id;
  state = applyAction(state, {
    type: "purchase",
    payload: {
      supplierId: state.suppliers[0].id,
      items: [{ productId: id, quantity: 3, cost: 205 }],
      paid: 615,
      reference: "Supplier test",
    },
  }).state;
  state = applyAction(state, {
    type: "checkout",
    payload: {
      items: [{ productId: id, quantity: 2 }],
      discount: 0,
      method: "cash",
      tendered: 480,
    },
  }).state;
  assert.throws(() => remove(state, id), /stock to zero/);
  state = applyAction(state, {
    type: "adjust",
    payload: {
      productId: id,
      quantity: -state.products[0].stock,
      reason: "Close inventory: damaged stock removed",
    },
  }).state;
  const before = structuredClone(state);
  const result = remove(state, id);
  const product = result.state.products.find((p) => p.id === id);
  assert.deepEqual(state, before);
  assert.equal(product.active, false);
  assert.ok(product.deletedAt);
  assert.equal(product.stock, before.products[0].stock);
  for (const key of [
    "sales",
    "purchases",
    "payments",
    "movements",
    "priceHistory",
  ])
    assert.deepEqual(result.state[key], before[key]);
  assert.equal(findProductByCode(result.state.products, product.sku), null);
  assert.throws(
    () =>
      applyAction(result.state, {
        type: "checkout",
        payload: {
          items: [{ productId: id, quantity: 1 }],
          discount: 0,
          method: "cash",
          tendered: 240,
        },
      }),
    /unavailable/,
  );
  assert.throws(
    () =>
      applyAction(result.state, {
        type: "purchase",
        payload: {
          supplierId: state.suppliers[0].id,
          items: [{ productId: id, quantity: 1, cost: 205 }],
          paid: 205,
        },
      }),
    /active product/,
  );
  assert.throws(
    () =>
      applyAction(result.state, {
        type: "hold",
        payload: { items: [{ productId: id, quantity: 1 }] },
      }),
    /unavailable/,
  );
  assert.throws(
    () =>
      applyAction(result.state, {
        type: "product",
        payload: { ...product, price: 240 },
      }),
    /deleted/,
  );
  assert.deepEqual(
    remove(result.state, id).state,
    result.state,
    "Repeat deletion must not change the deletion date or data",
  );
  const voided = applyAction(result.state, {
    type: "void",
    payload: { id: result.state.sales[0].id, reason: "Customer return" },
  }).state;
  assert.equal(
    voided.products.find((p) => p.id === id).stock,
    product.stock + 2,
  );
  assert.equal(voided.products.find((p) => p.id === id).active, false);
  const changed = relationalChanges(before, result.state);
  assert.equal(changed.products.length, 1);
  assert.equal(changed.inventory.length, 0);
  assert.equal(changed.sales.length, 0);
  assert.ok(
    relationalRows(result.state).products.find((p) => p.id === id).extras
      .deletedAt,
  );
});
test("product deletion requires confirmation and cannot leave a held bill with an unavailable product", () => {
  const state = seedState();
  const id = state.products[0].id;
  assert.throws(
    () =>
      applyAction(state, { type: "deleteProduct", payload: { productId: id } }),
    /DELETE/,
  );
  assert.throws(() => remove(state, "missing"), /not found/);
  const held = applyAction(state, {
    type: "hold",
    payload: {
      items: [{ productId: id, quantity: 1 }],
      label: "Later",
      discount: 0,
    },
  }).state;
  const closed = applyAction(held, {
    type: "adjust",
    payload: {
      productId: id,
      quantity: -held.products[0].stock,
      reason: "Inventory closure",
    },
  }).state;
  assert.throws(() => remove(closed, id), /held bills/);
  const released = applyAction(closed, {
    type: "deleteHold",
    payload: { id: held.held[0].id },
  }).state;
  assert.equal(remove(released, id).state.products[0].active, false);
});

test("deletion rejects nonzero inventory, including fractional and invalid stock", () => {
  for (const stock of [1, 0.01, -1, undefined, NaN]) {
    const state = seedState();
    state.products[0].stock = stock;
    const before = structuredClone(state);
    assert.throws(() => remove(state, state.products[0].id), /stock to zero/);
    assert.deepEqual(state, before);
  }
});
