import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { seedState } from "../../lib/domain.mjs";
import { addSupplierSample } from "../../lib/supplier-sample.mjs";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [1280, 720],
    [1024, 600],
    [844, 390],
    [390, 844],
    [375, 667],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const state = addSupplierSample(seedState(), "demo").state;
    await page.addInitScript(
      (state) =>
        localStorage.setItem(
          "ayngaran-demo-v1",
          JSON.stringify({ state, receipts: {} }),
        ),
      state,
    );
    await page.goto(process.env.POS_TEST_URL || "http://localhost:3000");
    const scanner = page.getByLabel("Hardware scanner", { exact: true });
    await scanner.waitFor();
    for (let i = 1; i <= 8; i++) {
      await scanner.fill(`AYS-${String(i).padStart(3, "0")}`);
      await scanner.press("Enter");
    }
    assert.ok(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth,
      ),
      `Page fits ${width}x${height}`,
    );
    assert.ok(
      await page
        .locator(".product-grid")
        .evaluate(
          (el) => el.scrollHeight > el.clientHeight && el.clientHeight > 80,
        ),
      "Product list scrolls inside a usable area",
    );
    if (width <= 720)
      await page.getByRole("button", { name: /View bill ·/ }).click();
    const checkout = page.getByRole("button", { name: /^Charge Rs\./ });
    const rect = await checkout.boundingBox();
    assert.ok(
      rect &&
        rect.y >= 0 &&
        rect.y + rect.height <= height - (width <= 720 ? 58 : 0),
      `Checkout fits ${width}x${height}`,
    );
    assert.ok(
      await page
        .locator(".bill-items")
        .evaluate(
          (el) => el.scrollHeight > el.clientHeight && el.clientHeight >= 80,
        ),
      `Bill items have usable scrolling area ${width}x${height}`,
    );
    await page
      .locator(".bill-items")
      .evaluate((el) => (el.scrollTop = el.scrollHeight));
    assert.equal(await page.evaluate(() => scrollY), 0);
    await checkout.click();
    await page.getByRole("dialog").waitFor();
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    if (width <= 720) {
      await page.getByRole("button", { name: /Back to products ·/ }).click();
      await page
        .getByPlaceholder("Search name, SKU or scan a barcode…")
        .fill("AYS-001");
      await page
        .getByPlaceholder("Search name, SKU or scan a barcode…")
        .press("Enter");
      const quantity = page.getByRole("spinbutton", {
        name: "Quantity of Samba Rice",
        exact: true,
      });
      await quantity.waitFor();
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("aria-label") ===
          "Quantity of Samba Rice",
      );
      await page.keyboard.type("3");
      await page.keyboard.press("Enter");
      assert.equal(
        await page
          .getByPlaceholder("Search name, SKU or scan a barcode…")
          .evaluate((el) => el === document.activeElement),
        true,
      );
      assert.equal(await page.locator(".bill-panel").isVisible(), false);
    }
    if (width === 1366) await page.screenshot({ path: "/tmp/billing-fit.png" });
    console.log(
      `PASS viewport ${width}x${height}: no page scrolling; internal lists and checkout reachable.`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
