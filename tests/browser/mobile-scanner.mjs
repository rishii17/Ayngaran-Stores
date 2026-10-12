import { chromium } from "playwright-core";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const events = [];
  let event;
  await page.route("**/api/mobile-scan/**", async (route) => {
    assert.equal(route.request().headers()["x-scanner-token"], "test-token");
    if (route.request().method() === "POST") {
      event = route.request().postDataJSON();
      events.push(event);
      await route.fulfill({ json: { ...event, status: "queued" } });
    } else
      await route.fulfill({
        json: {
          target: "purchase",
          event: event
            ? {
                ...event,
                status: "received",
                message: "Samba Rice added to purchase.",
              }
            : undefined,
        },
      });
  });
  await page.goto(
    (process.env.POS_TEST_URL || "http://localhost:3000") +
      "/mobile-scanner#test-id:test-token",
  );
  await page
    .getByText("Phone camera → desktop purchase", { exact: true })
    .waitFor();
  assert.equal(new URL(page.url()).hash, "");
  await page.getByLabel("Product code").fill("AYS-001");
  await page.getByRole("button", { name: "Send to desktop" }).click();
  await page
    .getByText("Samba Rice added to purchase.", { exact: true })
    .waitFor();
  assert.equal(events.length, 1);
  assert.equal(events[0].code, "AYS-001");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page
    .getByRole("button", { name: "Disconnect this phone", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("ayngaran-scanner-pair")),
    null,
  );
  await page
    .getByLabel("Desktop pairing link")
    .fill(
      (process.env.POS_TEST_URL || "http://localhost:3000") +
        "/mobile-scanner#test-id:test-token",
    );
  await page
    .getByRole("button", { name: "Connect to desktop", exact: true })
    .click();
  await page
    .getByText("Paste the complete HTTPS pairing link from your desktop.", {
      exact: true,
    })
    .waitFor();
  const response = await page.request.get(
    (process.env.POS_TEST_URL || "http://localhost:3000") +
      "/mobile-scanner.webmanifest",
  );
  const manifest = await response.json();
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons.length, 2);
  console.log(
    "PASS: mobile pairing fragment, capability request, scan acknowledgement, disconnect, install manifest and mobile layout.",
  );
} finally {
  await browser.close();
}
