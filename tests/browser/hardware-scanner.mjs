import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { seedState } from "../../lib/domain.mjs";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  const state = seedState();
  state.products[0].barcode = "012345678905";
  await page.addInitScript(
    (state) =>
      localStorage.setItem(
        "ayngaran-demo-v1",
        JSON.stringify({ state, receipts: {} }),
      ),
    state,
  );
  await page.goto(process.env.POS_TEST_URL || "http://localhost:3000");
  assert.equal(
    await page
      .getByRole("button", { name: "Connect phone scanner", exact: true })
      .count(),
    0,
  );
  const scan = page.getByLabel("Hardware scanner", { exact: true });
  await page
    .getByRole("button", { name: "Ready to scan", exact: true })
    .click();
  await page.keyboard.type("0012345678905");
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Charge Rs. 240.00", exact: true })
    .waitFor();
  assert.equal(await scan.inputValue(), "");
  assert.equal(
    await scan.evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.type("012345678905");
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Charge Rs. 480.00", exact: true })
    .waitFor();
  await page.keyboard.type("012345");
  await page.keyboard.press("Enter");
  await page
    .getByText("No matching product; check the desktop catalog.", {
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("button", { name: "Charge Rs. 480.00", exact: true })
    .waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
  await page.getByRole("button", { name: "Suppliers", exact: true }).click();
  await page
    .getByRole("button", { name: "Record purchase", exact: true })
    .click();
  await page.getByLabel("Supplier *").selectOption({ index: 1 });
  await page.getByLabel("Hardware scanner", { exact: true }).click();
  for (const code of ["012345678905", "AYS-002", "012345678905"]) {
    await page.keyboard.type(code);
    await page.keyboard.press("Enter");
  }
  assert.equal(
    await page.getByLabel("Samba Rice quantity", { exact: true }).inputValue(),
    "2",
  );
  assert.equal(
    await page
      .getByLabel("Red Raw Rice quantity", { exact: true })
      .inputValue(),
    "1",
  );
  assert.equal(await page.getByRole("dialog").count(), 1);
  await page
    .getByRole("button", { name: "Save purchase & receive stock" })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("ayngaran-demo-v1")).state,
  );
  assert.equal(saved.purchases[0].items.length, 2);
  assert.equal(
    (
      await page.request.get(
        (process.env.POS_TEST_URL || "http://localhost:3000") +
          "/mobile-scanner",
      )
    ).status(),
    404,
  );
  assert.equal(
    (
      await page.request.get(
        (process.env.POS_TEST_URL || "http://localhost:3000") +
          "/mobile-scanner.webmanifest",
      )
    ).status(),
    404,
  );
  console.log(
    "PASS: hardware keyboard scans, UPC/EAN matching, repeated quantity, unknown rejection, focus retention, purchase save and removed mobile app.",
  );
} finally {
  await browser.close();
}
