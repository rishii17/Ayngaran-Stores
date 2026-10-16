import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { seedState } from "../../lib/domain.mjs";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  const state = seedState();
  state.products = state.products.slice(0, 2);
  state.products[0].name = "Alpha Chilli Powder 100g";
  state.products[1].name = "Beta Chilli Powder 100g";
  state.suppliers[0].name = "Spice Company";
  state.purchases = [
    {
      id: "old",
      number: "PO-OLD",
      date: "2026-01-01",
      supplierId: state.suppliers[0].id,
      productId: state.products[0].id,
      cost: 80,
      quantity: 1,
      total: 80,
      paid: 80,
    },
    {
      id: "new",
      number: "PO-NEW",
      date: "2026-02-01",
      supplierId: state.suppliers[0].id,
      items: [
        {
          productId: state.products[0].id,
          cost: 90,
          unit: state.products[0].unit,
          quantity: 1,
        },
      ],
      total: 90,
      paid: 90,
    },
  ];
  await page.addInitScript(
    (data) => localStorage.setItem("ayngaran-demo-v1", JSON.stringify({ state: data })),
    state,
  );
  await page.goto(process.env.POS_TEST_URL || "http://localhost:3000");
  await page.getByRole("button", { name: "Suppliers", exact: true }).click();
  const panel = page.getByRole("region", { name: "Compare buying costs" });
  const search = panel.getByRole("textbox", {
    name: "Search products or companies",
  });
  await search.fill("chilli");
  await panel.getByText("2 results", { exact: true }).waitFor();
  assert.equal(await panel.locator("tbody tr").count(), 2);
  await search.fill("spice chilli");
  await panel.getByText("1 results", { exact: true }).waitFor();
  assert.match(await panel.locator("tbody").innerText(), /Alpha Chilli/);
  await panel.locator("summary").click();
  assert.match(await panel.locator("details").innerText(), /PO-OLD/);
  assert.match(await panel.locator("details").innerText(), /PO-NEW/);
  await search.fill("beta");
  await panel.getByText("No purchases recorded", { exact: true }).waitFor();
  await search.fill("unmatched company");
  await panel.getByText(/No matching products or companies/).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await search.fill("chilli");
  await panel.getByText("2 results", { exact: true }).waitFor();
  assert.equal(await search.isVisible(), true);
  console.log(
    "PASS: supplier product/brand/company search, previous costs, catalogue fallback, empty results and mobile search.",
  );
} finally {
  await browser.close();
}
