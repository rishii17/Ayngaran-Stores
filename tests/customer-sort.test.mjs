import test from "node:test";
import assert from "node:assert/strict";
import { sortCustomers } from "../lib/customer-sort.mjs";
const customers = [
  {
    id: "z",
    name: "Zed",
    village: "Hopton",
    openingBalance: 100,
    creditLimit: 500,
  },
  {
    id: "a",
    name: "Alice",
    village: "",
    openingBalance: 200,
    creditLimit: 900,
  },
  {
    id: "b",
    name: "Bob",
    village: "A Division",
    openingBalance: 50,
    creditLimit: 200,
  },
];
const state = {
  customers,
  sales: [
    { customerId: "z", total: 400, paid: 0 },
    { customerId: "a", total: 9999, paid: 0, void: true },
  ],
  payments: [{ customerId: "z", amount: 100 }],
};
const ids = (order, list = customers) =>
  sortCustomers(list, state, order).map((c) => c.id);
test("customer sorting uses names, villages, current balances and credit limits without changing records", () => {
  const original = structuredClone(state);
  assert.deepEqual(ids("name-asc"), ["a", "b", "z"]);
  assert.deepEqual(ids("name-desc"), ["z", "b", "a"]);
  assert.deepEqual(ids("village"), ["b", "z", "a"]);
  assert.deepEqual(ids("balance-desc"), ["z", "a", "b"]);
  assert.deepEqual(ids("balance-asc"), ["b", "a", "z"]);
  assert.deepEqual(ids("credit-desc"), ["a", "z", "b"]);
  assert.deepEqual(ids("balance-desc", customers.slice(1)), ["a", "b"]);
  assert.deepEqual(state, original);
  assert.deepEqual(sortCustomers([], state), []);
});
