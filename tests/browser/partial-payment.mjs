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
await p.getByLabel("Cash received (LKR)").fill("100");
assert.match(await p.getByRole("dialog").innerText(), /Added to customer credit/);
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
assert.match(await row.innerText(), /40.00/);
assert.deepEqual(errors, []);
await b.close();
console.log("PASS: partial cash checkout, customer bill history and remaining credit after collection");
