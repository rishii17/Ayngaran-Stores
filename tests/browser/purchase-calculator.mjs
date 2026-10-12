import { chromium } from "playwright-core";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto(process.env.POS_TEST_URL || "http://localhost:3000");
  await page
    .getByRole("heading", { name: "Point of sale", exact: true })
    .waitFor();
  await page.getByTitle("Calculator", { exact: true }).click();
  await page.keyboard.type("12+3");
  await page.keyboard.press("Enter");
  await page.getByText("1. 12 + 3 = 15", { exact: true }).waitFor();
  await page.getByRole("button", { name: "×", exact: true }).click();
  await page.keyboard.type("2");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(".calc-display strong").innerText(), "30");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(".calculator-history div").count(), 2);
  await page.keyboard.press("F4");
  await page.getByRole("heading", { name: "Quick calculator" }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Suppliers", exact: true }).click();
  await page
    .getByRole("button", { name: "Record purchase", exact: true })
    .click();
  await page.getByLabel("Supplier *").selectOption({ index: 1 });
  const search = page.getByLabel("Find products");
  await search.fill("samba");
  await search.press("Enter");
  await page
    .getByRole("button", { name: "Scan barcode / QR", exact: true })
    .click();
  await page.getByLabel("Or enter a barcode / QR value").fill("AYS-001");
  await page.getByRole("button", { name: "Find product", exact: true }).click();
  assert.equal(
    await page.getByLabel("Samba Rice quantity", { exact: true }).inputValue(),
    "2",
  );
  await search.fill("red raw");
  await search.press("Enter");
  await page.getByLabel("Samba Rice quantity", { exact: true }).fill("2");
  await page.getByLabel("Samba Rice cost", { exact: true }).fill("200");
  await page.getByLabel("Samba Rice sellingPrice", { exact: true }).fill("270");
  await page.getByLabel("Red Raw Rice cost", { exact: true }).fill("180");
  await page
    .getByLabel("Red Raw Rice sellingPrice", { exact: true })
    .fill("250");
  await page.getByLabel("Paid now (LKR)").fill("100");
  await page.getByLabel("Supplier invoice / reference").fill("BROWSER-MULTI");
  await page
    .getByRole("button", { name: "Save purchase & receive stock" })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const state = await page.evaluate(
    () => JSON.parse(localStorage.getItem("ayngaran-demo-v1")).state,
  );
  assert.equal(state.purchases[0].items.length, 2);
  assert.equal(state.purchases[0].total, 580);
  assert.equal(state.purchases[0].paid, 100);
  assert.equal(state.products[0].price, 270);
  await page.reload();
  await page.getByRole("button", { name: "Suppliers", exact: true }).click();
  await page.getByText("BROWSER-MULTI", { exact: true }).waitFor();
  console.log(
    "PASS: multi-product purchase, prices, payment, persistence, mixed mouse/keyboard calculator and shortcut isolation.",
  );
} finally {
  await browser.close();
}
