import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  emptyState,
  seedState,
  seedWithTransactions,
  applyAction,
  customerBalance,
} from "../lib/domain.mjs";
import {
  searchIndex,
  searchItems,
  contactFields,
  matchesBill,
  VILLAGES,
} from "../lib/search.mjs";
import { grossProfit, dailySummary, localDay } from "../lib/reporting.mjs";
import { createBackup, validDate } from "../lib/backup.mjs";
test("multiword product search works in any order and prioritizes exact SKU", () => {
  const s = seedState(),
    index = searchIndex(s.products, (p) => [
      p.name,
      p.tamil,
      p.sku,
      p.barcode,
      p.category,
    ]);
  assert.equal(searchItems(index, "rice samba")[0].name, "Samba Rice");
  assert.equal(searchItems(index, "AYS-001")[0].name, "Samba Rice");
  assert(searchItems(index, "அரிசி").length > 0);
  assert.equal(searchItems(index, "   ").length, 16);
});
test("villages, stable customer codes and identity search persist on edits", () => {
  let s = emptyState();
  let r = applyAction(s, {
    type: "customer",
    payload: {
      name: "Rishi",
      phone: "0771234567",
      address: "",
      village: "Hopton",
      openingBalance: 200,
      creditLimit: 2000,
    },
  });
  const c = r.result;
  assert.equal(c.code, "CUS-00001");
  s = applyAction(r.state, {
    type: "customer",
    payload: { ...c, village: "New Village", openingBalance: 9999 },
  }).state;
  assert.equal(s.customers[0].openingBalance, 200);
  assert.equal(s.customers[0].code, c.code);
  assert(s.villages.includes("New Village"));
  assert(VILLAGES.every((v) => s.villages.includes(v)));
  assert.equal(
    searchItems(searchIndex(s.customers, contactFields), "new rishi").length,
    1,
  );
});
test("price updates are logged and cannot rewrite historical profits", () => {
  let s = seedState();
  const p = s.products[0];
  s = applyAction(s, {
    type: "checkout",
    payload: {
      items: [{ productId: p.id, quantity: 2 }],
      method: "cash",
      tendered: 500,
      discount: 20,
    },
  }).state;
  const original = grossProfit(s.sales[0]);
  assert.equal(original, 50);
  s = applyAction(s, {
    type: "price",
    payload: {
      productId: p.id,
      price: 300,
      cost: 250,
      reason: "Supplier increase",
    },
  }).state;
  assert.equal(grossProfit(s.sales[0]), original);
  assert.equal(s.priceHistory[0].oldPrice, 240);
  assert.equal(s.priceHistory[0].newPrice, 300);
  assert.throws(
    () =>
      applyAction(s, {
        type: "price",
        payload: { productId: p.id, price: 0, cost: 0, reason: "Bad" },
      }),
    /positive/,
  );
});
test("dummy seed works once only on empty store", () => {
  const r = applyAction(emptyState(), {
    type: "seed",
    payload: { confirm: "LOAD DUMMY DATA" },
  });
  assert.equal(r.state.sales.length, 7);
  assert.equal(r.state.products.length, 16);
  assert(r.state.customers.every((c) => c.village));
  assert.throws(
    () =>
      applyAction(r.state, {
        type: "seed",
        payload: { confirm: "LOAD DUMMY DATA" },
      }),
    /empty store/,
  );
  assert.throws(
    () =>
      applyAction(emptyState(), { type: "seed", payload: { confirm: "yes" } }),
    /Confirm/,
  );
});
test("bill search supports sale ID, customer ID, code and village", () => {
  const s = seedWithTransactions(),
    sale = s.sales[0];
  for (const q of [
    sale.id,
    sale.number,
    sale.customerId,
    sale.customerCode,
    sale.customerVillage,
  ])
    assert(matchesBill(sale, q, s.customers));
  assert(!matchesBill(sale, "no such customer", s.customers));
});
test("day boundaries are Sri Lankan and voids do not inflate profits", () => {
  assert.equal(localDay("2026-10-11T19:00:00Z"), "2026-10-12");
  const s = seedWithTransactions(),
    sale = s.sales[0];
  sale.date = "2026-10-11T19:00:00Z";
  s.sales = [sale];
  assert.equal(dailySummary(s, "2026-10-12").bills, 1);
  sale.void = true;
  assert.equal(grossProfit(sale), 0);
  assert.equal(dailySummary(s, "2026-10-12").bills, 0);
});
test("Excel backup includes typed numbers, exact IDs, inert text and a recoverable full snapshot", async () => {
  const s = seedWithTransactions();
  s.customers[0].name = '=HYPERLINK("https://example.com")';
  const date = localDay(new Date().toISOString());
  const bytes = await createBackup(s, date, "demo");
  const b = new ExcelJS.Workbook();
  await b.xlsx.load(bytes);
  assert.equal(b.getWorksheet("All sales").rowCount, 8);
  assert.equal(
    b.getWorksheet("Current products").getCell("E2").type,
    ExcelJS.ValueType.String,
  );
  assert.equal(
    b.getWorksheet("Current customers").getCell("C2").type,
    ExcelJS.ValueType.String,
  );
  assert.equal(
    b.getWorksheet("All sales").getCell("L2").type,
    ExcelJS.ValueType.Number,
  );
  const restore = b.getWorksheet("Restore JSON");
  let text = "";
  for (let i = 2; i <= restore.rowCount; i++)
    text += restore.getCell(i, 2).value;
  const data = JSON.parse(text);
  assert.deepEqual(data.state, s);
  assert.equal(
    b.getWorksheet("Current customers").getCell("I2").value,
    customerBalance(s, s.customers[0].id),
  );
});
test("invalid calendar dates rejected before backup", () => {
  assert.throws(() => validDate("2026-02-30"), /valid/);
  assert.throws(() => validDate("../data"), /valid/);
  assert.equal(validDate("2026-10-12"), "2026-10-12");
});

test("legacy customer codes remain stable and do not collide with new codes", () => {
  const s = seedState(),
    old = s.customers[0];
  const code = contactFields(old)[4];
  const edit = applyAction(s, {
    type: "customer",
    payload: { ...old, village: "Hopton" },
  });
  const added = applyAction(edit.state, {
    type: "customer",
    payload: {
      name: "New",
      phone: "",
      address: "",
      openingBalance: 0,
      creditLimit: 1000,
    },
  });
  assert.equal(edit.result.code, code);
  assert.notEqual(edit.result.code, added.result.code);
  assert.equal(
    searchItems(
      searchIndex(added.state.customers, contactFields),
      "0771234567",
    )[0].id,
    old.id,
  );
});
test("sample barcodes have valid EAN-13 check digits", () => {
  for (const p of seedState().products) {
    assert.match(p.barcode, /^\d{13}$/);
    const sum = [...p.barcode].reduce(
      (a, n, i) => a + Number(n) * (i % 2 ? 3 : 1),
      0,
    );
    assert.equal(sum % 10, 0);
  }
});

test("environment gate rejects browser secret keys without printing them", async () => {
  const { spawnSync } = await import("node:child_process");
  const key = "sb_secret_fake_do_not_expose";
  const r = spawnSync(process.execPath, ["scripts/check-env.mjs"], {
    encoding: "utf8",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
    },
  });
  assert.equal(r.status, 1);
  assert(!r.stderr.includes(key));
  const missing = spawnSync(
    process.execPath,
    ["scripts/check-env.mjs", "--allow-missing"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      },
    },
  );
  assert.equal(missing.status, 0);
});
