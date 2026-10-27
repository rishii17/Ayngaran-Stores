import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAction,
  seedState,
  totals,
  linePricing,
  customerBalance,
} from "../lib/domain.mjs";
import { grossProfit } from "../lib/reporting.mjs";
import { createBackup } from "../lib/backup.mjs";
import ExcelJS from "exceljs";
const checkout = (state, items, extra = {}) =>
  applyAction(state, {
    type: "checkout",
    payload: { items, discount: 0, method: "cash", tendered: 9999, ...extra },
  });

test("amount and percentage product discounts combine with bill discount, tax and credit", () => {
  const state = seedState();
  state.settings.taxRate = 10;
  Object.assign(state.products[0], {
    discountType: "percent",
    discountValue: 10,
  }); // 240 -> 216
  Object.assign(state.products[1], {
    discountType: "amount",
    discountValue: 20,
  }); // 220 -> 200
  const before = structuredClone(state);
  const { result, state: saved } = checkout(
    state,
    [
      { productId: state.products[0].id, quantity: 2 },
      { productId: state.products[1].id, quantity: 0.5 },
    ],
    { discount: 12, customerId: state.customers[0].id, tendered: 100 },
  );
  assert.equal(result.subtotal, 590);
  assert.equal(result.productDiscount, 58);
  assert.equal(result.billDiscount, 12);
  assert.equal(result.discount, 70);
  assert.equal(result.tax, 52);
  assert.equal(result.total, 572);
  assert.equal(result.items[0].price, 240);
  assert.equal(result.items[0].netPrice, 216);
  assert.equal(result.items[0].lineTotal, 432);
  assert.equal(result.items[1].lineTotal, 100);
  assert.equal(grossProfit(result), 17.5);
  assert.equal(
    customerBalance(saved, state.customers[0].id) -
      customerBalance(state, state.customers[0].id),
    472,
  );
  assert.equal(saved.products[0].stock, state.products[0].stock - 2);
  assert.deepEqual(state, before);
  const original = structuredClone(result);
  const edited = applyAction(saved, {
    type: "product",
    payload: { ...saved.products[0], price: 500, cost: 400, discountValue: 50 },
  }).state;
  assert.deepEqual(edited.sales[0], original);
  assert.equal(grossProfit(edited.sales[0]), 17.5);
  const voided = applyAction(saved, {
    type: "void",
    payload: { id: result.id, reason: "Return" },
  }).state;
  assert.equal(voided.products[0].stock, state.products[0].stock);
  assert.equal(grossProfit(voided.sales[0]), 0);
});

test("bill overrides and held bills preserve discounts; duplicate lines must agree", () => {
  let state = seedState();
  Object.assign(state.products[0], {
    discountType: "percent",
    discountValue: 15,
  });
  const line = {
    productId: state.products[0].id,
    quantity: 1,
    discountType: "amount",
    discountValue: 5,
    price: 1,
    cost: 0,
    lineTotal: 0,
  };
  const sale = checkout(state, [line, line]).result;
  assert.equal(sale.items.length, 1);
  assert.equal(sale.total, 470);
  assert.equal(sale.items[0].price, 240);
  assert.equal(sale.items[0].discountValue, 5);
  assert.throws(
    () => checkout(state, [line, { ...line, discountValue: 6 }]),
    /same discount/,
  );
  assert.equal(
    checkout(state, [{ ...line, discountValue: 0 }]).result.total,
    240,
  );
  state = applyAction(state, {
    type: "hold",
    payload: { items: [line], discount: 2, label: "Later" },
  }).state;
  assert.equal(state.held[0].items[0].discountValue, 5);
  const held = state.held[0];
  state.products[0].discountValue = 50;
  const resumed = checkout(state, held.items, {
    discount: held.discount,
    heldId: held.id,
  });
  assert.equal(resumed.result.total, 233);
  assert.equal(resumed.state.held.length, 0);
});

test("invalid discounts and price changes cannot bypass authoritative validation", () => {
  const state = seedState();
  const product = state.products[0];
  for (const setting of [
    { discountType: "percent", discountValue: 101 },
    { discountType: "amount", discountValue: 241 },
    { discountType: "amount", discountValue: -1 },
    { discountType: "percent", discountValue: 0.001 },
    { discountType: "other", discountValue: 1 },
    { discountType: "amount", discountValue: NaN },
  ]) {
    assert.throws(
      () =>
        checkout(state, [{ productId: product.id, quantity: 1, ...setting }]),
      /discount/i,
    );
    assert.throws(
      () =>
        applyAction(state, {
          type: "product",
          payload: { ...product, ...setting },
        }),
      /discount/i,
    );
    assert.throws(
      () =>
        applyAction(state, {
          type: "hold",
          payload: {
            items: [{ productId: product.id, quantity: 1, ...setting }],
          },
        }),
      /discount/i,
    );
  }
  Object.assign(product, { discountType: "amount", discountValue: 230 });
  assert.throws(
    () =>
      checkout(state, [{ productId: product.id, quantity: 1 }], {
        discount: 11,
      }),
    /exceeds subtotal/,
  );
  assert.throws(
    () =>
      applyAction(state, {
        type: "price",
        payload: {
          productId: product.id,
          price: 220,
          cost: 200,
          reason: "New price",
        },
      }),
    /exceeds selling price/,
  );
  assert.throws(
    () =>
      applyAction(state, {
        type: "purchase",
        payload: {
          supplierId: state.suppliers[0].id,
          items: [
            {
              productId: product.id,
              quantity: 1,
              cost: 200,
              sellingPrice: 220,
            },
          ],
          paid: 200,
        },
      }),
    /exceeds selling price/,
  );
  assert.equal(state.sales.length, 0);
});

test("discount rounding, fully discounted items and legacy lines remain consistent", () => {
  assert.deepEqual(
    linePricing({
      price: 9.99,
      quantity: 1.25,
      discountType: "percent",
      discountValue: 15,
    }),
    {
      unitDiscount: 1.5,
      netPrice: 8.49,
      lineSubtotal: 12.49,
      discountAmount: 1.88,
      lineTotal: 10.61,
    },
  );
  const total = totals(
    [
      {
        price: 0.01,
        quantity: 0.5,
        discountType: "percent",
        discountValue: 100,
      },
    ],
    0,
    18,
  );
  assert.equal(total.total, 0);
  assert.equal(total.discount, total.subtotal);
  assert.equal(totals([{ price: 240, quantity: 2 }], 20).total, 460);
  const state = seedState();
  assert.equal(
    checkout(
      state,
      [
        {
          productId: state.products[0].id,
          quantity: 1,
          discountType: "percent",
          discountValue: 100,
        },
      ],
      { tendered: 0 },
    ).result.total,
    0,
  );
});

test("Excel backup retains original prices, item savings and final totals", async () => {
  const initial = seedState();
  const { state } = checkout(
    initial,
    [
      {
        productId: initial.products[0].id,
        quantity: 2,
        discountType: "percent",
        discountValue: 10,
      },
    ],
    { discount: 2 },
  );
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await createBackup(state, "2026-10-27"));
  const sheet = book.getWorksheet("All sale items");
  const headers = sheet.getRow(1).values;
  const cell = (header) =>
    sheet.getRow(2).getCell(headers.indexOf(header)).value;
  assert.equal(cell("Selling price at sale"), 240);
  assert.equal(cell("Original line total"), 480);
  assert.equal(cell("Product discount total"), 48);
  assert.equal(cell("Line total"), 432);
  assert.equal(cell("Final unit price"), 216);
});
