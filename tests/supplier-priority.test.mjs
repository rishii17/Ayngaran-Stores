import test from "node:test";
import assert from "node:assert/strict";
import { seedState, applyAction, supplierBalance } from "../lib/domain.mjs";
import { supplierPriorities } from "../lib/supplier-priority.mjs";
import { validCalendarDate } from "../lib/calendar-date.mjs";
const supplier = (id, amount, extra = {}) => ({
  id,
  name: id,
  openingBalance: amount,
  ...extra,
});
test("supplier priority orders overdue/today/upcoming dates before unscheduled balances and settled accounts", () => {
  const state = seedState();
  state.suppliers = [
    supplier("Unscheduled", 1000),
    supplier("Tomorrow", 200, { paymentDueDate: "2026-10-29" }),
    supplier("Overdue", 100, { nextChequeDate: "2026-10-27" }),
    supplier("Today", 300, { nextVisitDate: "2026-10-28" }),
    supplier("Settled", 0, { paymentDueDate: "2026-10-01" }),
  ];
  const original = structuredClone(state);
  assert.deepEqual(
    supplierPriorities(state.suppliers, state, "2026-10-28").map(
      (r) => r.supplier.id,
    ),
    ["Overdue", "Today", "Tomorrow", "Unscheduled", "Settled"],
  );
  assert.equal(
    supplierPriorities(state.suppliers, state, "2026-10-28", "balance")[0]
      .supplier.id,
    "Unscheduled",
  );
  assert.equal(
    supplierPriorities(state.suppliers, state, "2026-10-28", "cheque")[0]
      .supplier.id,
    "Overdue",
  );
  assert.equal(
    supplierPriorities(state.suppliers, state, "2026-10-28", "visit")[0]
      .supplier.id,
    "Today",
  );
  assert.deepEqual(state, original);
});
test("last payment includes cash/bank collections and paid purchase invoices, ignoring unpaid invoices", () => {
  const state = seedState();
  const id = state.suppliers[0].id;
  state.purchases = [
    { supplierId: id, paid: 10, total: 100, date: "2026-10-26T20:00:00Z" },
    { supplierId: id, paid: 0, total: 50, date: "2026-10-28T00:00:00Z" },
  ];
  state.payments = [
    {
      supplierId: id,
      amount: 20,
      paymentMethod: "bank",
      date: "2026-10-25T00:00:00Z",
    },
    {
      supplierId: state.suppliers[1].id,
      amount: 5,
      date: "2026-10-28T00:00:00Z",
    },
  ];
  const row = supplierPriorities(state.suppliers, state, "2026-10-28").find(
    (r) => r.supplier.id === id,
  );
  assert.equal(row.lastPayment, "2026-10-26T20:00:00Z");
  assert.equal(row.balance, supplierBalance(state, id));
});
test("reminders validate dates and money, preserve balances, and survive supplier contact edits", () => {
  let state = seedState();
  const id = state.suppliers[0].id;
  const balance = supplierBalance(state, id);
  const before = structuredClone(state);
  state = applyAction(state, {
    type: "supplierSchedule",
    payload: {
      supplierId: id,
      paymentDueDate: "2026-10-29",
      nextChequeDate: "2026-10-30",
      chequeAmount: 500,
      chequeReference: "CH-01",
      lastVisitDate: "2026-10-01",
      nextVisitDate: "2026-11-01",
    },
  }).state;
  assert.equal(supplierBalance(state, id), balance);
  for (const key of ["sales", "purchases", "payments", "cashMovements"])
    assert.deepEqual(state[key], before[key]);
  state = applyAction(state, {
    type: "supplier",
    payload: {
      id,
      name: "Updated company",
      openingBalance: 99999,
      phone: "123",
      address: "Town",
    },
  }).state;
  assert.equal(state.suppliers[0].nextChequeDate, "2026-10-30");
  assert.equal(supplierBalance(state, id), balance);
  for (const payload of [
    { paymentDueDate: "2026-02-30" },
    { nextVisitDate: "bad" },
    { lastVisitDate: "2099-01-01" },
    { chequeAmount: -1 },
    { chequeAmount: 0.001 },
    { supplierId: "missing" },
  ]) {
    const original = structuredClone(state);
    assert.throws(() =>
      applyAction(state, {
        type: "supplierSchedule",
        payload: { supplierId: id, ...payload },
      }),
    );
    assert.deepEqual(state, original);
  }
  assert.throws(
    () =>
      applyAction(state, {
        type: "supplierSchedule",
        payload: { supplierId: id, nextChequeDate: "" },
      }),
    /cheque date/,
  );
  state = applyAction(state, {
    type: "supplierSchedule",
    payload: {
      supplierId: id,
      nextChequeDate: "",
      chequeAmount: 0,
      chequeReference: "",
    },
  }).state;
  assert.equal(state.suppliers[0].nextChequeDate, "");
  assert.equal(supplierBalance(state, id), balance);
  assert.equal(validCalendarDate("2028-02-29"), true);
  assert.equal(validCalendarDate("2026-02-29"), false);
});

test("Excel supplier export includes payment, cheque and visit reminders", async () => {
  const { createBackup } = await import("../lib/backup.mjs");
  const { default: ExcelJS } = await import("exceljs");
  const state = seedState();
  Object.assign(state.suppliers[0], {
    paymentDueDate: "2026-11-01",
    nextChequeDate: "2026-11-02",
    chequeAmount: 200,
    chequeReference: "CH-02",
    lastVisitDate: "2026-10-01",
    nextVisitDate: "2026-11-03",
  });
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await createBackup(state, "2026-10-28"));
  const sheet = book.getWorksheet("Current suppliers");
  const headers = sheet.getRow(1).values;
  assert.equal(
    sheet.getRow(2).getCell(headers.indexOf("Next cheque date")).value,
    "2026-11-02",
  );
  assert.equal(
    sheet.getRow(2).getCell(headers.indexOf("Cheque reminder amount")).value,
    200,
  );
  assert.equal(
    sheet.getRow(2).getCell(headers.indexOf("Next visit")).value,
    "2026-11-03",
  );
});
