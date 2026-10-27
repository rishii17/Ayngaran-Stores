import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.POS_TEST_URL || "http://localhost:3000");
  const navigate = async (name) => {
    await page
      .getByRole("button", { name: "Toggle navigation", exact: true })
      .click();
    await page.getByRole("button", { name, exact: true }).click();
  };
  const saved = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("ayngaran-demo-v1")).state,
    );
  await navigate("Cash drawer");
  await page.getByLabel("Opening cash (LKR)", { exact: true }).fill("1000");
  await page.getByRole("button", { name: "Start drawer", exact: true }).click();
  await page.getByLabel("Counted cash (LKR)", { exact: true }).waitFor();
  await navigate("Point of sale");
  const scanner = page.getByLabel("Hardware scanner", { exact: true });
  await scanner.fill("AYS-001");
  await scanner.press("Enter");
  await page
    .getByRole("button", { name: "Charge Rs. 240.00", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Complete sale", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await navigate("Customers");
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  await page.getByLabel("Name *", { exact: true }).fill("Cash Loan Buyer");
  await page.getByLabel("Credit limit (LKR)", { exact: true }).fill("1000");
  await page
    .getByRole("button", { name: "Save customer", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const row = page.getByRole("row").filter({ hasText: "Cash Loan Buyer" });
  await row.getByRole("button", { name: "Lend cash", exact: true }).click();
  await page
    .getByLabel("Cash credit amount (LKR)", { exact: true })
    .fill("100");
  await page
    .getByLabel("Cash credit reason", { exact: true })
    .fill("Owner cash loan");
  await page
    .getByRole("button", { name: "Save cash credit", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal((await saved()).sales.length, 1);
  assert.equal((await saved()).customerCredits.length, 1);
  await row.getByRole("button", { name: "View account", exact: true }).click();
  await page
    .getByText("Cash lent · Owner cash loan", { exact: false })
    .waitFor();
  assert.equal(await page.locator(".customer-bills tbody tr").count(), 0);
  await page
    .getByRole("button", { name: "Record collection", exact: true })
    .click();
  await page.getByLabel("Amount (LKR) *", { exact: true }).fill("40");
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await row.getByRole("button", { name: "Lend cash", exact: true }).click();
  await page.getByLabel("Cash credit amount (LKR)", { exact: true }).fill("50");
  await page
    .getByLabel("Money source", { exact: true })
    .selectOption("external");
  await page
    .getByLabel("Cash credit reason", { exact: true })
    .fill("Owner personal funds");
  await page
    .getByRole("button", { name: "Save cash credit", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await row.getByRole("button", { name: "View account", exact: true }).click();
  await page
    .getByRole("button", { name: "Record collection", exact: true })
    .click();
  await page.getByLabel("Amount (LKR) *", { exact: true }).fill("10");
  await page.getByLabel("Payment method", { exact: true }).selectOption("bank");
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.match(await row.innerText(), /100.00/);
  await navigate("Cash drawer");
  const expected = page
    .getByRole("row")
    .filter({ hasText: "Expected drawer cash" });
  await expected.getByText("Rs. 1180.00", { exact: true }).waitFor();
  await page.getByLabel("Counted cash (LKR)", { exact: true }).fill("1175");
  assert.match(
    await page
      .getByRole("status")
      .filter({ hasText: "Cash difference" })
      .innerText(),
    /-5.00/,
  );
  await page
    .getByLabel("Closing note / difference reason", { exact: true })
    .fill("Five rupees short after count");
  await page.getByRole("button", { name: "Close drawer", exact: true }).click();
  await page
    .getByRole("button", { name: "Start drawer", exact: true })
    .waitFor();
  const closed = (await saved()).cashSessions[0];
  assert.equal(closed.closingSummary.expected, 1180);
  assert.equal(closed.countedCash, 1175);
  assert.equal(closed.difference, -5);
  await navigate("Point of sale");
  await scanner.fill("AYS-001");
  await scanner.press("Enter");
  await page
    .getByRole("button", { name: "Charge Rs. 240.00", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Complete sale", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.deepEqual((await saved()).cashSessions[0], closed);
  await page.reload();
  await navigate("Cash drawer");
  await page
    .getByText("Five rupees short after count", { exact: true })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: optional drawer opening, cash sale, cash/external customer loans, collections/bank exclusion, no loan bills, closing difference/history, post-close sales and mobile reload.",
  );
} finally {
  await browser.close();
}
