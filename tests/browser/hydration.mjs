import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const base = process.env.POS_TEST_URL || "http://localhost:3000";
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  // Simulate an extension changing the parsed DOM, preserving the dev server's
  // network identity so its HMR websocket remains available in Chromium.
  await page.addInitScript(() => {
    const annotated = new WeakSet();
    window.__ayngaranHiddenMetadataInjected = 0;
    const apply = () => {
      document.body?.setAttribute(
        "__processed_fdd542fe-0d00-4c68-a450-05e27be68444__",
        "true",
      );
      const loading = document.querySelector(".loading");
      if (loading) {
        loading.setAttribute("bis_skin_checked", "1");
        window.__ayngaranExtensionInjected = true;
      }
      for (const element of document.querySelectorAll("div[hidden]")) {
        if (annotated.has(element)) continue;
        annotated.add(element);
        element.setAttribute("bis_skin_checked", "1");
        window.__ayngaranHiddenMetadataInjected++;
      }
      if (
        window.__ayngaranExtensionInjected &&
        window.__ayngaranHiddenMetadataInjected
      )
        observer.disconnect();
    };
    const observer = new MutationObserver(apply);
    observer.observe(document, { childList: true, subtree: true });
    apply();
  });
  await page.goto(base);
  await page
    .getByRole("button", { name: "Sign in to live store", exact: true })
    .waitFor();
  assert.ok(
    await page.evaluate(() => window.__ayngaranHiddenMetadataInjected > 0),
    "The extension fixture must annotate Next's metadata wrapper",
  );
  assert.equal(await page.locator("div[hidden][bis_skin_checked]").count(), 0);
  assert.ok(
    (await page.locator("div[hidden]").count()) > 0,
    "Metadata wrappers and their hidden attribute must remain intact",
  );
  assert.equal(
    await page.evaluate(async () => {
      const node = document.createElement("div");
      node.hidden = true;
      node.setAttribute("bis_skin_checked", "1");
      document.body.append(node);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const value = node.getAttribute("bis_skin_checked");
      node.remove();
      return value;
    }),
    "1",
    "Extension cleanup must stop after hydration",
  );
  assert.equal(
    await page
      .locator("body")
      .getAttribute("__processed_fdd542fe-0d00-4c68-a450-05e27be68444__"),
    "true",
  );
  assert.equal(
    await page
      .getByRole("button", { name: /Create.*account|register/i })
      .count(),
    0,
  );
  assert.equal(await page.locator(".app-shell").count(), 0);
  assert.equal(await page.title(), "Ayngaran Stores · Point of Sale");
  assert.equal(
    await page.locator('meta[name="description"]').getAttribute("content"),
    "Billing, inventory and customer accounts for Ayngaran Stores.",
  );
  assert.deepEqual(
    errors.filter((text) =>
      /hydrat|didn't match|server rendered|React error #4(?:18|23|25)/i.test(
        text,
      ),
    ),
    [],
  );
  console.log(
    "PASS: extension-injected body/loading/hidden metadata attributes hydrate without mismatch; public screen contains login only.",
  );
} finally {
  await browser.close();
}
