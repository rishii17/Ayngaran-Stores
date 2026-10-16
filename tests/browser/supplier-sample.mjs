import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.POS_TEST_URL || "http://localhost:3000");
  await page
    .getByRole("heading", { name: "Point of sale", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Load supplier sample list", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText(/184 products/)
    .waitFor();
  await page
    .getByRole("button", { name: "Add supplier sample products", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const panel = page.getByRole("region", { name: "Compare buying costs" });
  const search = panel.getByRole("textbox", {
    name: "Search products or companies",
  });
  await search.fill("toothpaste");
  await panel.getByText("12 results", { exact: true }).waitFor();
  assert.match(await panel.innerText(), /Clogard/);
  assert.match(await panel.innerText(), /Signal/);
  await search.fill("Coca-Cola 250ml");
  await panel.getByText("1 results", { exact: true }).waitFor();
  assert.match(await panel.innerText(), /98.00/);
  assert.match(await panel.innerText(), /120.00/);
  assert.match(await panel.innerText(), /18.3%/);
  await panel.locator("summary").click();
  assert.match(await panel.locator("details").innerText(), /PO-00001/);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ayngaran-demo-v1")),
  );
  assert.equal(saved.state.products.length, 200);
  assert.equal(saved.state.purchases.length, 1);
  assert.equal(
    saved.state.products.filter((p) => p.active === false).length,
    2,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Supplier sample list loaded", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Supplier sample list loaded", exact: true })
      .isDisabled(),
    true,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page
      .getByRole("button", { name: "Supplier sample list loaded", exact: true })
      .isVisible(),
    true,
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Mobile page must not overflow horizontally",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: supplier sample import, English brand search, costs/margin/history, persistence, repeat protection and mobile banner.",
  );
} finally {
  await browser.close();
}
