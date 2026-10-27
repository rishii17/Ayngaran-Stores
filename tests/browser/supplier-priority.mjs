import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { seedState } from "../../lib/domain.mjs";
import { cashDay } from "../../lib/cash-ledger.mjs";
const today = cashDay(new Date());
const offset = (n) =>
  cashDay(new Date(new Date(today + "T12:00:00Z").getTime() + n * 86400000));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = seedState();
  state.suppliers = [
    {
      ...state.suppliers[0],
      name: "Overdue Supply",
      openingBalance: 500,
      nextChequeDate: offset(-1),
      chequeAmount: 200,
      chequeReference: "CH-101",
      lastVisitDate: offset(-3),
    },
    {
      ...state.suppliers[1],
      name: "Large Balance Supply",
      openingBalance: 1500,
    },
    {
      id: crypto.randomUUID(),
      name: "Settled Supply",
      openingBalance: 0,
      phone: "",
      address: "",
    },
  ];
  await page.addInitScript((state) => {
    if (!localStorage.getItem("ayngaran-demo-v1"))
      localStorage.setItem(
        "ayngaran-demo-v1",
        JSON.stringify({ state, receipts: {} }),
      );
  }, state);
  await page.goto(process.env.POS_TEST_URL || "http://localhost:3000");
  const navigate = async () => {
    await page
      .getByRole("button", { name: "Toggle navigation", exact: true })
      .click();
    await page.getByRole("button", { name: "Suppliers", exact: true }).click();
  };
  await navigate();
  const panel = page.getByRole("region", {
    name: "Supplier payment priorities",
    exact: true,
  });
  const names = () =>
    panel.locator("tbody tr td:first-child strong").allTextContents();
  await panel.getByText("Overdue · cheque", { exact: true }).waitFor();
  assert.deepEqual(await names(), [
    "Overdue Supply",
    "Large Balance Supply",
    "Settled Supply",
  ]);
  assert.equal(
    await page.getByRole("region", { name: "Compare buying costs" }).count(),
    0,
  );
  await panel
    .getByRole("combobox", { name: "Sort suppliers", exact: true })
    .selectOption("balance");
  assert.equal((await names())[0], "Large Balance Supply");
  const large = panel
    .getByRole("row")
    .filter({ hasText: "Large Balance Supply" });
  await large.getByRole("button", { name: "Plan dates", exact: true }).click();
  await page.getByLabel("Payment due date", { exact: true }).fill(offset(1));
  await page.getByLabel("Next supplier visit", { exact: true }).fill(offset(3));
  await page
    .getByRole("button", { name: "Save supplier dates", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.match(await large.innerText(), /1,500.00/);
  assert.match(await large.innerText(), /Upcoming · payment/);
  await panel
    .getByRole("combobox", { name: "Sort suppliers", exact: true })
    .selectOption("priority");
  const overdue = panel.getByRole("row").filter({ hasText: "Overdue Supply" });
  await overdue
    .getByRole("button", { name: "Pay supplier", exact: true })
    .click();
  await page.getByLabel("Amount (LKR) *", { exact: true }).fill("100");
  await page.getByLabel("Payment method", { exact: true }).selectOption("bank");
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.match(await overdue.innerText(), /400.00/);
  assert.match(await overdue.innerText(), new RegExp(today));
  await overdue
    .getByRole("button", { name: "View account", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await page.getByLabel("Name *", { exact: true }).fill("Overdue Updated");
  await page
    .getByRole("button", { name: "Save supplier", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const updated = panel.getByRole("row").filter({ hasText: "Overdue Updated" });
  assert.match(await updated.innerText(), /CH-101/);
  await page.getByLabel("Search suppliers", { exact: true }).fill("Overdue");
  assert.equal((await names()).length, 1);
  await page.getByLabel("Search suppliers", { exact: true }).fill("");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page
    .getByRole("button", { name: "Compare buying costs", exact: true })
    .click();
  await page
    .getByLabel("Search products or companies", { exact: true })
    .fill("rice");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  assert.equal(
    await page.getByRole("region", { name: "Compare buying costs" }).count(),
    0,
  );
  await page.reload();
  await navigate();
  await panel.getByText("Overdue · cheque", { exact: true }).waitFor();
  assert.match(await updated.innerText(), /CH-101/);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("ayngaran-demo-v1")).state,
  );
  assert.equal(saved.payments.length, 1);
  assert.equal(saved.suppliers[1].paymentDueDate, offset(1));
  assert.deepEqual(errors, []);
  console.log(
    "PASS: payable-first supplier page, priority/balance sorting, planning without payment, payment date update, edit preservation, compare-button modal, mobile and reload.",
  );
} finally {
  await browser.close();
}
