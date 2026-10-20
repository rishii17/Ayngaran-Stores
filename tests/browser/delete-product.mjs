import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { seedWithTransactions } from "../../lib/domain.mjs";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const fixture = seedWithTransactions();
  const product = fixture.products[0];
  await page.addInitScript((state) => {
    if (!localStorage.getItem("ayngaran-demo-v1"))
      localStorage.setItem(
        "ayngaran-demo-v1",
        JSON.stringify({ state, receipts: {} }),
      );
  }, fixture);
  await page.goto(process.env.POS_TEST_URL || "http://localhost:3000");
  const navigate = async (name) => {
    await page
      .getByRole("button", { name: "Toggle navigation", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: name === "Inventory" ? /^Inventory\b/ : name,
        exact: name !== "Inventory",
      })
      .click();
  };
  const scanner = page.getByLabel("Hardware scanner", { exact: true });
  await scanner.fill(product.sku);
  await scanner.press("Enter");
  await navigate("Products");
  const deletion = () =>
    page.getByRole("button", { name: `Delete ${product.name}`, exact: true });
  await deletion().click();
  await page.getByRole("alert").filter({ hasText: "current bill" }).waitFor();
  await page
    .getByLabel("Type DELETE to confirm", { exact: true })
    .fill("DELETE");
  assert.equal(
    await page
      .getByRole("button", { name: "Delete product", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await navigate("Point of sale");
  await page
    .getByRole("button", { name: `Remove ${product.name}`, exact: true })
    .click();
  await navigate("Products");
  await deletion().click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Stock remaining:" })
    .waitFor();
  await page
    .getByLabel("Type DELETE to confirm", { exact: true })
    .fill("DELETE");
  assert.equal(
    await page
      .getByRole("button", { name: "Delete product", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await navigate("Inventory");
  const stockRow = page
    .locator(".panel")
    .filter({ has: page.getByPlaceholder("Search products, SKU or barcode") })
    .locator("tbody tr")
    .filter({ hasText: product.sku });
  await stockRow.getByRole("button", { name: "Adjust", exact: true }).click();
  await page
    .getByLabel("Quantity change *", { exact: true })
    .fill(String(-product.stock));
  await page
    .getByLabel("Reason *", { exact: true })
    .fill("Close inventory: damaged stock removed");
  await page
    .getByRole("button", { name: "Save stock adjustment", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const closed = await page.evaluate(
    () => JSON.parse(localStorage.getItem("ayngaran-demo-v1")).state,
  );
  assert.equal(closed.products.find((p) => p.id === product.id).stock, 0);
  assert.equal(closed.movements.length, fixture.movements.length + 1);
  await deletion().click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await deletion().count(), 1);
  await deletion().click();
  await page
    .getByLabel("Type DELETE to confirm", { exact: true })
    .fill("delete");
  assert.equal(
    await page
      .getByRole("button", { name: "Delete product", exact: true })
      .isDisabled(),
    true,
  );
  await page
    .getByLabel("Type DELETE to confirm", { exact: true })
    .fill("DELETE");
  await page
    .getByRole("button", { name: "Delete product", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(await deletion().count(), 0);
  let state = await page.evaluate(
    () => JSON.parse(localStorage.getItem("ayngaran-demo-v1")).state,
  );
  const deleted = state.products.find((p) => p.id === product.id);
  assert.equal(deleted.active, false);
  assert.ok(deleted.deletedAt);
  assert.equal(deleted.stock, 0);
  for (const key of ["sales", "purchases", "movements", "priceHistory"])
    assert.deepEqual(state[key], closed[key]);
  await navigate("Inventory");
  await page
    .getByPlaceholder("Search products, SKU or barcode")
    .fill(product.sku);
  const inventory = page
    .locator(".panel")
    .filter({ has: page.getByPlaceholder("Search products, SKU or barcode") })
    .locator("tbody tr")
    .filter({ hasText: product.sku });
  await inventory.getByText("Deleted", { exact: true }).waitFor();
  assert.equal(await inventory.count(), 1);
  assert.match(await inventory.innerText(), /Deleted/);
  assert.equal(
    (await inventory.locator("td").nth(4).innerText()).trim(),
    `0 ${product.unit}`,
  );
  await navigate("Point of sale");
  await page
    .getByPlaceholder("Search name, SKU or scan a barcode…")
    .fill(product.name);
  await page.waitForFunction(
    () => document.querySelectorAll(".product-card").length === 0,
  );
  assert.equal(await page.locator(".product-card").count(), 0);
  await scanner.fill(product.sku);
  await scanner.press("Enter");
  await page
    .getByText("No matching product; check the desktop catalog.", {
      exact: true,
    })
    .waitFor();
  await navigate("Suppliers");
  await page
    .getByRole("button", { name: "Record purchase", exact: true })
    .click();
  await page.getByLabel("Find products", { exact: true }).fill(product.name);
  await page.waitForFunction(
    () => document.querySelectorAll(".purchase-results button").length === 0,
  );
  assert.equal(await page.locator(".purchase-results button").count(), 0);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Toggle navigation", exact: true })
    .waitFor();
  state = await page.evaluate(
    () => JSON.parse(localStorage.getItem("ayngaran-demo-v1")).state,
  );
  assert.equal(state.products.find((p) => p.id === product.id).active, false);
  await navigate("Products");
  assert.equal(await deletion().count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: zero-stock closure guard, recorded adjustment, Inventory deletion, confirmation/cancel/current-bill guard, catalogue and scanner removal, retained inventory/history, purchase exclusion and reload persistence.",
  );
} finally {
  await browser.close();
}
