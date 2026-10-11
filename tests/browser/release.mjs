import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
mkdirSync("artifacts", { recursive: true });
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const p = await b.newPage({
  viewport: { width: 1440, height: 1050 },
  acceptDownloads: true,
});
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(process.env.POS_TEST_URL || "http://localhost:3000");
await p.getByRole("heading", { name: "Point of sale", exact: true }).waitFor();
await p.getByRole("button", { name: "Add customer", exact: true }).click();
await p.getByLabel("Name *", { exact: true }).fill("Village Test Buyer");
await p.getByLabel("Phone", { exact: true }).fill("0771122445");
await p.getByLabel("Village (optional)", { exact: true }).fill("Hopton");
await p.getByRole("button", { name: "Save customer", exact: true }).click();
await p.getByRole("dialog").waitFor({ state: "hidden" });
assert.match(
  await p.getByRole("combobox", { name: "Search POS customers" }).inputValue(),
  /Village Test Buyer/,
);
await p
  .getByPlaceholder("Search name, SKU or scan a barcode…")
  .fill("rice samba");
await p.getByPlaceholder("Search name, SKU or scan a barcode…").press("Enter");
await p.getByRole("button", { name: "Charge Rs. 240.00" }).click();
await p.getByRole("button", { name: "Credit", exact: true }).click();
await p.getByRole("button", { name: "Complete sale", exact: true }).click();
await p.getByText("Gross profit on this sale", { exact: true }).waitFor();
assert.match(await p.locator(".modal .payment-balance").innerText(), /35.00/);
await p.getByRole("button", { name: "Done", exact: true }).click();
await p.getByRole("combobox", { name: "Search POS customers" }).fill("hopton");
await p.getByRole("option", { name: /Village Test Buyer/ }).click();
await p.getByRole("button", { name: "View bills", exact: true }).click();
await p.getByRole("main").getByText("AYS-00001", { exact: true }).waitFor();
await p
  .getByPlaceholder("Search bill, sale ID, customer, phone or village")
  .fill("0771122445");
await p.getByRole("main").getByText("AYS-00001", { exact: true }).waitFor();
await p.getByRole("button", { name: "Customers", exact: true }).click();
const row = p.getByRole("row").filter({ hasText: "Village Test Buyer" });
await row.getByRole("button", { name: "View account" }).click();
await p
  .getByRole("textbox", { name: "Search this customer's bills" })
  .fill("00001");
await p.getByRole("button", { name: "View / print", exact: true }).click();
await p.getByRole("button", { name: "Done", exact: true }).click();
await row.getByRole("button", { name: "View account" }).click();
await p.getByRole("button", { name: "Record collection", exact: true }).click();
await p.getByLabel("Amount (LKR) *").fill("100");
await p.getByRole("button", { name: "Save payment", exact: true }).click();
await p.getByRole("dialog").waitFor({ state: "hidden" });
assert.match(await row.innerText(), /140.00/);
await p.getByRole("button", { name: "Products", exact: true }).click();
await p
  .getByRole("row")
  .filter({ hasText: "Samba Rice" })
  .getByRole("button", { name: "Price", exact: true })
  .click();
await p.getByLabel("New selling price (LKR)").fill("300");
await p.getByLabel("New purchase cost (LKR)").fill("250");
await p.getByLabel("Reason for price update").fill("Supplier price change");
await p.getByRole("button", { name: "Save price update", exact: true }).click();
await p.getByText("Supplier price change", { exact: true }).waitFor();
await p.getByRole("button", { name: "Sales & reports", exact: true }).click();
await p.getByRole("button", { name: "View receipt", exact: true }).click();
assert.match(await p.locator(".modal .payment-balance").innerText(), /35.00/);
await p.getByRole("button", { name: "Done", exact: true }).click();
await p.getByRole("button", { name: "Settings", exact: true }).click();
const dlPromise = p.waitForEvent("download");
await p
  .getByRole("button", { name: "Download Excel backup", exact: true })
  .click();
const dl = await dlPromise;
await dl.saveAs(resolve("artifacts/sample-daily-backup.xlsx"));
assert.match(dl.suggestedFilename(), /\.xlsx$/);
await p
  .getByText("Excel backup downloaded. Keep a copy outside this device.", {
    exact: true,
  })
  .waitFor();
await p
  .getByRole("button", {
    name: "Load dummy data into empty store",
    exact: true,
  })
  .click();
await p.getByLabel("Type LOAD DUMMY DATA to confirm").fill("LOAD DUMMY DATA");
await p.getByRole("button", { name: "Load dummy data", exact: true }).click();
await p.getByRole("alert").filter({ hasText: "empty store" }).waitFor();
await p.getByRole("button", { name: "Close dialog" }).click();
await p.getByRole("button", { name: "Point of sale", exact: true }).click();
await p.getByRole("combobox", { name: "Search POS customers" }).fill("hopton");
await p.getByRole("option", { name: /Village Test Buyer/ }).click();
await p.screenshot({ path: resolve("artifacts/release-preview.png") });
await p.setViewportSize({ width: 390, height: 844 });
assert.equal(
  await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
);
if (errors.length) throw Error(errors.join("\n"));
console.log(
  "PASS: POS village customer, credit sale, phone/bill search, account receipt, collection balance, price history, immutable profit, XLSX download, seed overwrite guard, mobile layout.",
);
await b.close();
