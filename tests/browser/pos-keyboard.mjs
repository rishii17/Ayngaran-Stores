import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto(process.env.POS_TEST_URL || "http://localhost:3000");
  const menu = page.getByRole("button", {
    name: "Toggle navigation",
    exact: true,
  });
  await menu.waitFor();
  const drawer = page.getByRole("dialog", { name: "Main navigation" });
  assert.equal(await drawer.isVisible(), false);
  assert.equal(
    await page
      .locator(".main-shell")
      .evaluate((el) => el.getBoundingClientRect().left),
    0,
  );
  await menu.click();
  await drawer.waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Close navigation", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  await drawer.waitFor({ state: "hidden" });
  assert.equal(
    await menu.evaluate((el) => el === document.activeElement),
    true,
  );
  await menu.click();
  await drawer.getByRole("button", { name: "Dashboard", exact: true }).click();
  await drawer.waitFor({ state: "hidden" });
  await page.keyboard.press("F2");
  const search = page.getByPlaceholder("Search name, SKU or scan a barcode…");
  await search.waitFor();
  assert.equal(
    await search.evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.type("AYS-001");
  await page.keyboard.press("Enter");
  const qty = page.getByRole("spinbutton", {
    name: "Quantity of Samba Rice",
    exact: true,
  });
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("aria-label") ===
      "Quantity of Samba Rice",
  );
  await page.keyboard.type("2.5");
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Charge Rs. 600.00", exact: true })
    .waitFor();
  assert.equal(
    await search.evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(await qty.inputValue(), "2.5");
  await page.keyboard.type("AYS-001");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("aria-label") ===
      "Quantity of Samba Rice",
  );
  await page.keyboard.type("999");
  await page.keyboard.press("Enter");
  assert.equal(await qty.evaluate((el) => el === document.activeElement), true);
  assert.equal(await qty.evaluate((el) => el.checkValidity()), false);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Charge Rs. 840.00", exact: true })
    .waitFor();
  assert.equal(await qty.inputValue(), "3.5");
  assert.equal(
    await search.evaluate((el) => el === document.activeElement),
    true,
  );
  await page
    .locator(".product-card")
    .filter({ hasText: "Red Raw Rice" })
    .click();
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("aria-label") ===
      "Quantity of Red Raw Rice",
  );
  await page.keyboard.type("2");
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Charge Rs. 1,280.00", exact: true })
    .waitFor();
  await qty.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Enter");
  assert.equal(await qty.evaluate((el) => el.checkValidity()), false);
  await page.keyboard.press("Escape");
  assert.equal(await qty.inputValue(), "3.5");
  await page.setViewportSize({ width: 390, height: 844 });
  await menu.click();
  await drawer.waitFor();
  await page.keyboard.press("Shift+Tab");
  assert.equal(await drawer.locator(":focus").count(), 1);
  await drawer.getByRole("button", { name: "Suppliers", exact: true }).click();
  await drawer.waitFor({ state: "hidden" });
  assert.equal(
    await page
      .getByRole("heading", { name: "Suppliers", exact: true })
      .isVisible(),
    true,
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  console.log(
    "PASS: full-width workspace, desktop/mobile drawer, Escape/focus, keyboard quantity replacement, fractional quantities, stock validation and next-product search.",
  );
} finally {
  await browser.close();
}
