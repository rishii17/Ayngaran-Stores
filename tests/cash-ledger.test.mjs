import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { applyAction, seedState, customerBalance } from "../lib/domain.mjs";
import { cashDay, openDrawer, drawerSummary } from "../lib/cash-ledger.mjs";
import { dailySummary } from "../lib/reporting.mjs";
import { createBackup } from "../lib/backup.mjs";
const act = (state, type, payload) => applyAction(state, { type, payload });
const sale = (state, extra = {}) =>
  act(state, "checkout", {
    items: [{ productId: state.products[0].id, quantity: 1 }],
    discount: 0,
    tendered: 500,
    method: "cash",
    ...extra,
  });

test("opening cash is optional and a customer cash advance creates no sale, stock or profit", () => {
  let state = seedState();
  const customer = state.customers[0];
  const before = structuredClone(state);
  const balance = customerBalance(state, customer.id);
  state = act(state, "customerCredit", {
    customerId: customer.id,
    amount: 100,
    source: "drawer",
    note: "Cash loan",
  }).state;
  assert.equal(customerBalance(state, customer.id), balance + 100);
  assert.deepEqual(state.sales, before.sales);
  assert.deepEqual(state.products, before.products);
  assert.deepEqual(state.movements, before.movements);
  assert.equal(state.customers[0].openingBalance, customer.openingBalance);
  assert.equal(state.cashMovements.length, 0);
  const summary = dailySummary(state, cashDay(new Date()));
  assert.equal(summary.cashCreditIssued, 100);
  assert.equal(summary.sales, 0);
  assert.equal(summary.profit, 0);
  assert.equal(sale(state).result.total, 240);
});

test("drawer reconciles actual cash receipts, change, credit collections and cash outflows", () => {
  const initial = seedState();
  initial.suppliers[0].openingBalance = 100;
  let state = act(initial, "openDrawer", { amount: 1000 }).state;
  const customerId = state.customers[0].id;
  state = sale(state, {
    items: [{ productId: state.products[0].id, quantity: 2 }],
    tendered: 1000,
  }).state; // Net cash in 480, not tendered 1000.
  state = sale(state, { method: "card", tendered: 0 }).state;
  state = sale(state, { customerId, method: "credit", tendered: 50 }).state;
  state = act(state, "payment", {
    customerId,
    amount: 100,
    note: "Collection",
  }).state;
  state = act(state, "payment", {
    customerId,
    amount: 25,
    paymentMethod: "bank",
    note: "Bank collection",
  }).state;
  state = act(state, "purchase", {
    supplierId: state.suppliers[0].id,
    items: [{ productId: state.products[0].id, quantity: 1, cost: 200 }],
    paid: 200,
  }).state;
  state = act(state, "purchase", {
    supplierId: state.suppliers[0].id,
    items: [{ productId: state.products[0].id, quantity: 1, cost: 70 }],
    paid: 70,
    paymentMethod: "bank",
  }).state;
  state = act(state, "payment", {
    supplierId: state.suppliers[0].id,
    amount: 50,
    note: "Supplier payment",
  }).state;
  state = act(state, "customerCredit", {
    customerId,
    amount: 100,
    source: "drawer",
    note: "Cash loan",
  }).state;
  state = act(state, "customerCredit", {
    customerId,
    amount: 50,
    source: "external",
    note: "Owner personal funds",
  }).state;
  state = act(state, "drawerMovement", {
    amount: 20,
    direction: "in",
    note: "Owner top-up",
  }).state;
  state = act(state, "drawerMovement", {
    amount: 10,
    direction: "out",
    note: "Cash removed",
  }).state;
  const summary = drawerSummary(state, openDrawer(state));
  assert.deepEqual(summary, {
    opening: 1000,
    cashIn: 650,
    cashOut: 360,
    cashSales: 530,
    collections: 100,
    purchases: 200,
    supplierPayments: 50,
    customerCredits: 100,
    added: 20,
    withdrawn: 10,
    expected: 1290,
  });
  assert.equal(state.cashMovements.length, 8);
  assert.equal(state.sales[0].paid, 50);
});

test("closing freezes cash reconciliation, requires discrepancy reasons and permits a later session", () => {
  let state = act(seedState(), "openDrawer", { amount: 100 }).state;
  assert.throws(
    () => act(state, "openDrawer", { amount: 10 }),
    /Close the existing/,
  );
  const id = openDrawer(state).id;
  assert.throws(
    () => act(state, "closeDrawer", { sessionId: id, amount: 99 }),
    /Explain the difference/,
  );
  state = act(state, "closeDrawer", {
    sessionId: id,
    amount: 99,
    note: "One rupee short",
  }).state;
  const closed = structuredClone(state.cashSessions[0]);
  assert.equal(closed.difference, -1);
  assert.equal(closed.closingSummary.expected, 100);
  state = sale(state).state;
  assert.deepEqual(state.cashSessions[0], closed);
  assert.equal(state.cashMovements.length, 0);
  assert.throws(
    () =>
      act(state, "drawerMovement", {
        amount: 1,
        direction: "in",
        note: "Top-up",
      }),
    /Open today/,
  );
  state = act(state, "openDrawer", { amount: 99 }).state;
  assert.equal(drawerSummary(state, openDrawer(state)).expected, 99);
  assert.throws(
    () => act(state, "closeDrawer", { sessionId: id, amount: 99 }),
    /already closed/,
  );
});

test("Sri Lanka midnight never assigns new-day transactions to a stale drawer", () => {
  assert.equal(cashDay("2026-10-26T18:29:59Z"), "2026-10-26");
  assert.equal(cashDay("2026-10-26T18:30:00Z"), "2026-10-27");
  let state = seedState();
  state.cashSessions.push({
    id: crypto.randomUUID(),
    day: "2000-01-01",
    openedAt: "2000-01-01T00:00:00Z",
    openingAmount: 100,
  });
  state = sale(state).state;
  assert.equal(state.cashMovements.length, 0);
  assert.throws(
    () => act(state, "openDrawer", { amount: 100 }),
    /Close the existing/,
  );
  assert.throws(
    () =>
      act(state, "drawerMovement", {
        amount: 1,
        direction: "in",
        note: "Top-up",
      }),
    /Open today/,
  );
  assert.equal(
    act(state, "closeDrawer", {
      sessionId: state.cashSessions[0].id,
      amount: 100,
    }).result.countedCash,
    100,
  );
});

test("customer advances respect credit limits, repayments, validation and atomicity", () => {
  let state = seedState();
  const customer = state.customers[0];
  customer.openingBalance = 0;
  customer.creditLimit = 100;
  const payload = {
    customerId: customer.id,
    amount: 80,
    source: "external",
    note: "Cash loan",
  };
  for (const extra of [
    { amount: -1 },
    { amount: 0 },
    { amount: 0.001 },
    { amount: 101 },
    { source: "invalid" },
    { note: " " },
    { customerId: "missing" },
  ]) {
    const before = structuredClone(state);
    assert.throws(() => act(state, "customerCredit", { ...payload, ...extra }));
    assert.deepEqual(state, before);
  }
  state = act(state, "customerCredit", payload).state;
  assert.equal(customerBalance(state, customer.id), 80);
  assert.throws(
    () =>
      sale(state, { customerId: customer.id, method: "credit", tendered: 0 }),
    /credit limit/,
  );
  assert.throws(
    () => act(state, "payment", { customerId: customer.id, amount: 81 }),
    /exceeds outstanding/,
  );
  state = act(state, "payment", {
    customerId: customer.id,
    amount: 80,
    paymentMethod: "bank",
  }).state;
  assert.equal(customerBalance(state, customer.id), 0);
  assert.equal(state.sales.length, 0);
});

test("voiding a bill retains cash until an explicit cash refund, and backups include drawer/loan history", async () => {
  let state = act(seedState(), "openDrawer", { amount: 1000 }).state;
  const saved = sale(state);
  state = saved.state;
  state = act(state, "void", {
    id: saved.result.id,
    reason: "Sale cancelled; refund separately",
  }).state;
  assert.equal(drawerSummary(state, openDrawer(state)).expected, 1240);
  state = act(state, "drawerMovement", {
    amount: 240,
    direction: "out",
    note: "Refund " + saved.result.number,
  }).state;
  state = act(state, "customerCredit", {
    customerId: state.customers[0].id,
    amount: 100,
    source: "drawer",
    note: "Cash loan",
  }).state;
  assert.equal(drawerSummary(state, openDrawer(state)).expected, 900);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await createBackup(state, cashDay(new Date())));
  assert.equal(book.getWorksheet("Customer cash credits").rowCount, 2);
  assert.equal(book.getWorksheet("Cash drawer sessions").rowCount, 2);
  assert.equal(book.getWorksheet("Cash drawer movements").rowCount, 4);
});
