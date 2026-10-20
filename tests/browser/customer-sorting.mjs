import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { seedState } from "../../lib/domain.mjs";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  const state = seedState();
  state.customers = [
    {
      id: "z",
      name: "Zed",
      phone: "0771",
      address: "",
      village: "Hopton",
      openingBalance: 500,
      creditLimit: 1000,
    },
    {
      id: "a",
      name: "Alice",
      phone: "0772",
      address: "",
      village: "",
      openingBalance: 100,
      creditLimit: 3000,
    },
    {
      id: "b",
      name: "Bob",
      phone: "0773",
      address: "",
      village: "A Division",
      openingBalance: 200,
      creditLimit: 2000,
    },
  ];
  await page.addInitScript(
    (state) =>
      localStorage.setItem(
        "ayngaran-demo-v1",
        JSON.stringify({ state, receipts: {} }),
      ),
    state,
  );
  await page.goto(process.env.POS_TEST_URL || "http://localhost:3000");
  await page
    .getByRole("button", { name: "Toggle navigation", exact: true })
    .click();
  await page.getByRole("button", { name: "Customers", exact: true }).click();
  const sort = page.getByRole("combobox", { name: "Sort customers" });
  const names = async () =>
    page.locator("tbody tr .person-cell strong").allTextContents();
  await page.waitForFunction(
    () => document.querySelectorAll("tbody tr").length === 3,
  );
  assert.deepEqual(await names(), ["Alice", "Bob", "Zed"]);
  for (const [order, expected] of [
    ["name-desc", ["Zed", "Bob", "Alice"]],
    ["balance-desc", ["Zed", "Bob", "Alice"]],
    ["balance-asc", ["Alice", "Bob", "Zed"]],
    ["village", ["Bob", "Zed", "Alice"]],
    ["credit-desc", ["Alice", "Bob", "Zed"]],
  ]) {
    await sort.selectOption(order);
    assert.deepEqual(await names(), expected);
  }
  await page
    .getByPlaceholder("Search customers by name, phone, ID or village")
    .fill("Hopton");
  assert.deepEqual(await names(), ["Zed"]);
  await page
    .getByPlaceholder("Search customers by name, phone, ID or village")
    .fill("");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await sort.isVisible());
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  console.log(
    "PASS: all customer sort orders, filtered results and mobile layout.",
  );
} finally {
  await browser.close();
}
