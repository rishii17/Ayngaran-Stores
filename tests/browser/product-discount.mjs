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
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const fixture = seedState();
  const [first, second] = fixture.products;
  Object.assign(second, { discountType: "amount", discountValue: 20 });
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
    await page.getByRole("button", { name, exact: true }).click();
  };
  await navigate("Products");
  await page
    .getByRole("row")
    .filter({ hasText: first.sku })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page
    .getByLabel("Discount type", { exact: true })
    .selectOption("percent");
  await page.getByLabel("Discount value", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await navigate("Point of sale");
  const scanner = page.getByLabel("Hardware scanner", { exact: true });
  for (const product of [first, first, second]) {
    await scanner.fill(product.sku);
    await scanner.press("Enter");
  }
  await page
    .getByRole("button", { name: "Charge Rs. 632.00", exact: true })
    .waitFor();
  const firstLine = page.locator(".bill-item").filter({ hasText: first.name });
  assert.match(await firstLine.innerText(), /216.00/);
  assert.match(await firstLine.innerText(), /240.00/);
  assert.match(await firstLine.innerText(), /48.00/);
  await page.locator("#discount").fill("12");
  await page
    .getByRole("button", { name: "Charge Rs. 620.00", exact: true })
    .waitFor();
  assert.match(await page.locator(".bill-summary").innerText(), /80.00/);
  // Per-bill override must not edit the saved product default.
  await page
    .getByLabel("Discount value for " + first.name, { exact: true })
    .fill("5");
  await page
    .getByRole("button", { name: "Charge Rs. 644.00", exact: true })
    .waitFor();
  await page
    .getByLabel("Discount value for " + first.name, { exact: true })
    .fill("10");
  await page.getByRole("button", { name: "Hold bill", exact: true }).click();
  await page.getByText("Bill held", { exact: true }).waitFor();
  await page.getByRole("button", { name: /^Held/ }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page
    .getByRole("button", { name: "Charge Rs. 620.00", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByLabel("Discount value for " + first.name, { exact: true })
      .inputValue(),
    "10",
  );
  for (const [width, height] of [
    [1280, 720],
    [390, 844],
    [375, 667],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    if (width < 900) {
      const view = page.getByRole("button", { name: /View bill/ });
      if (await view.isVisible()) await view.click();
    }
    const charge = page.getByRole("button", {
      name: "Charge Rs. 620.00",
      exact: true,
    });
    await charge.scrollIntoViewIfNeeded();
    const rect = await charge.boundingBox();
    assert.ok(
      rect && rect.y >= 0 && rect.y + rect.height <= height + 1,
      `Checkout reachable at ${width}x${height}`,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    );
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page
    .getByRole("button", { name: "Charge Rs. 620.00", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Complete sale", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Sale receipt", exact: true })
    .waitFor();
  const receipt = page.getByRole("dialog").locator(".receipt");
  assert.match(await receipt.innerText(), /Original: 240.00/);
  assert.match(await receipt.innerText(), /10%/);
  assert.match(await receipt.innerText(), /After discount: 216.00/);
  assert.match(await receipt.innerText(), /Product discounts[\s\S]*68.00/);
  assert.match(await receipt.innerText(), /Bill discount[\s\S]*12.00/);
  assert.match(await receipt.innerText(), /Total discounts[\s\S]*80.00/);
  assert.match(await receipt.innerText(), /TOTAL LKR[\s\S]*620.00/);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("ayngaran-demo-v1")).state,
  );
  assert.equal(saved.sales[0].total, 620);
  assert.equal(saved.sales[0].items[0].price, 240);
  assert.equal(saved.products[0].discountValue, 10);
  assert.equal(saved.held.length, 0);
  await page.evaluate((id) => {
    const data = JSON.parse(localStorage.getItem("ayngaran-demo-v1"));
    data.state.products[0].discountValue = 50;
    data.state.held.push({
      id: crypto.randomUUID(),
      items: [{ productId: id, quantity: 1 }],
      discount: 0,
      label: "Legacy hold",
      date: new Date().toISOString(),
    });
    localStorage.setItem("ayngaran-demo-v1", JSON.stringify(data));
  }, first.id);
  await page.reload();
  await page.getByRole("button", { name: /^Held/ }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page
    .getByRole("button", { name: "Charge Rs. 240.00", exact: true })
    .waitFor();
  await page.locator("#discount").fill("10");
  await page
    .getByLabel("Discount type for " + first.name, { exact: true })
    .selectOption("percent");
  await page
    .getByLabel("Discount value for " + first.name, { exact: true })
    .fill("100");
  await page
    .getByRole("button", { name: "Charge Rs. 0.00", exact: true })
    .waitFor();
  assert.equal(await page.locator("#discount").inputValue(), "");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: default percentage/amount discounts, bill override, original/net prices, combined savings, hold/resume, viewport fit, receipt/reload, legacy holds and bill-discount cap.",
  );
} finally {
  await browser.close();
}
