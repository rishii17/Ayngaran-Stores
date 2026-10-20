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
    const apply = () => {
      document.body?.setAttribute(
        "__processed_fdd542fe-0d00-4c68-a450-05e27be68444__",
        "true",
      );
      const loading = document.querySelector(".loading");
      if (loading) {
        loading.setAttribute("bis_skin_checked", "1");
        window.__ayngaranExtensionInjected = true;
        observer.disconnect();
      }
    };
    const observer = new MutationObserver(apply);
    observer.observe(document, { childList: true, subtree: true });
    apply();
  });
  await page.goto(base);
  await page
    .getByRole("button", { name: "Sign in to live store", exact: true })
    .waitFor();
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
  assert.deepEqual(
    errors.filter((text) =>
      /hydrat|didn't match|server rendered|React error #4(?:18|23|25)/i.test(
        text,
      ),
    ),
    [],
  );
  console.log(
    "PASS: extension-injected body/loading attributes hydrate without mismatch; public screen contains login only.",
  );
} finally {
  await browser.close();
}
