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
  const fixture = seedState();
  const [first, second] = fixture.products;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.POS_TEST_URL || "http://localhost:3000");
  const scan = async (sku) => {
    const input = page.getByLabel("Hardware scanner", { exact: true });
    await input.fill(sku);
    await input.press("Enter");
  };
  await scan(first.sku);
  await scan(first.sku);
  await scan(second.sku);
  assert.equal(await page.locator(".bill-purchase-cost").count(), 0);
  await page
    .getByRole("button", { name: "Show purchase costs", exact: true })
    .click();
  assert.equal(await page.locator(".bill-purchase-cost").count(), 2);
  const cost = page.getByLabel("Purchase cost of " + first.name, {
    exact: true,
  });
  assert.match(await cost.innerText(), /205.00/);
  assert.match(await cost.innerText(), /410.00/);
  await page.emulateMedia({ media: "print" });
  assert.equal(await cost.isVisible(), false);
  await page.emulateMedia({ media: "screen" });
  await page
    .getByLabel("Quantity of " + first.name, { exact: true })
    .fill("1.5");
  await page
    .getByLabel("Quantity of " + first.name, { exact: true })
    .press("Enter");
  assert.match(await cost.innerText(), /307.50/);
  await page
    .getByRole("button", { name: "Hide purchase costs", exact: true })
    .click();
  assert.equal(await page.locator(".bill-purchase-cost").count(), 0);
  await page
    .getByRole("button", { name: "Show purchase costs", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  const bill = page.getByRole("button", { name: /View bill/ });
  if (await bill.isVisible()) await bill.click();
  assert.ok(await cost.isVisible());
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollHeight <= innerHeight + 1 &&
        document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page
    .getByRole("button", { name: "Hide purchase costs", exact: true })
    .click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page
    .getByRole("button", { name: "Show purchase costs", exact: true })
    .click();
  const nav = async (name) => {
    await page
      .getByRole("button", { name: "Toggle navigation", exact: true })
      .click();
    await page.getByRole("button", { name, exact: true }).click();
  };
  await nav("Customers");
  await nav("Point of sale");
  assert.equal(await page.locator(".bill-purchase-cost").count(), 0);
  await page
    .getByRole("button", { name: "Show purchase costs", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Charge Rs. 580.00", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Complete sale", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Sale receipt", exact: true })
    .waitFor();
  assert.equal(await page.locator(".bill-purchase-cost").count(), 0);
  assert.doesNotMatch(
    await page.getByRole("dialog").locator(".receipt").innerText(),
    /Purchase cost|Line cost/,
  );
  assert.doesNotMatch(
    await page.locator(".print-only").textContent(),
    /Purchase cost|Line cost/,
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Show purchase costs", exact: true })
      .isDisabled(),
    true,
  );
  await scan(first.sku);
  assert.equal(await page.locator(".bill-purchase-cost").count(), 0);
  await page
    .getByRole("button", { name: "Show purchase costs", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Toggle navigation", exact: true })
    .waitFor();
  assert.equal(await page.locator(".bill-purchase-cost").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: purchase costs hidden by default, unit/quantity costs, hide/reset on navigation/checkout/reload, mobile fit and receipt/print exclusion.",
  );
} finally {
  await browser.close();
}
