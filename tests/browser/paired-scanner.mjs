import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { scannerService } from "../../server/mobile-scanner.mjs";
import { seedState } from "../../lib/domain.mjs";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const service = scannerService();
const owner = "00000000-0000-4000-8000-000000000001";
try {
  const context = await browser.newContext();
  const errors = [];
  await context.addInitScript(
    ({ owner }) => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const session = {
        access_token:
          "eyJhbGciOiJIUzI1NiJ9." +
          btoa(JSON.stringify({ sub: owner, exp })) +
          ".fixture",
        refresh_token: "fixture",
        expires_at: exp,
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: owner,
          aud: "authenticated",
          email: "fixture@example.invalid",
        },
      };
      localStorage.setItem(
        "sb-uoddttvmpqkojdwofcxr-auth-token",
        JSON.stringify(session),
      );
      localStorage.setItem("ayngaran-mode", "live");
    },
    { owner },
  );
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname,
      method = route.request().method(),
      body = method === "POST" ? route.request().postDataJSON() : {};
    try {
      if (path === "/api/state")
        return route.fulfill({ json: { state: seedState(), revision: 0 } });
      if (path.startsWith("/api/scanner-pairs")) {
        const parts = path.split("/");
        const id = parts[3];
        let result;
        if (method === "POST" && !id)
          result = service.create(owner, body.target);
        else if (method === "DELETE") result = service.remove(id, owner);
        else if (parts[4] === "ack")
          result = service.ack(id, owner, body.id, body.message);
        else result = { events: service.owner(id, owner).events };
        return route.fulfill({ json: result });
      }
      if (path.startsWith("/api/mobile-scan/")) {
        const id = path.split("/")[3],
          token = route.request().headers()["x-scanner-token"];
        if (method === "POST")
          return route.fulfill({
            json: service.submit(id, token, body.id, body.code),
          });
        const s = service.phone(id, token);
        return route.fulfill({
          json: {
            target: s.target,
            event: s.seen.get(url.searchParams.get("event")),
          },
        });
      }
      if (url.hostname === "scanner.test") {
        const response = await route.fetch({
          url:
            (process.env.POS_TEST_URL || "http://localhost:3000") +
            path +
            url.search,
        });
        return route.fulfill({ response });
      }
      return route.abort();
    } catch (e) {
      return route.fulfill({ status: 400, json: { error: e.message } });
    }
  });
  const desktop = await context.newPage();
  desktop.on("pageerror", (e) => errors.push(e.message));
  await desktop.goto("https://scanner.test");
  await desktop
    .getByRole("button", { name: "Connect phone scanner", exact: true })
    .click();
  await desktop.getByLabel("Phone pairing QR code").waitFor();
  const link = await desktop
    .getByRole("link", { name: "Open mobile scanner" })
    .getAttribute("href");
  assert.ok(link.includes("#"));
  const phone = await context.newPage();
  await phone.goto(link);
  await phone
    .getByText("Phone camera → desktop bill", { exact: true })
    .waitFor();
  await phone.getByLabel("Product code").fill("AYS-001");
  await phone.getByRole("button", { name: "Send to desktop" }).click();
  await phone.getByText(/Samba Rice: scan processed/).waitFor();
  await desktop
    .getByRole("button", { name: "Charge Rs. 240.00", exact: true })
    .waitFor();
  await phone.getByLabel("Product code").fill("AYS-001");
  await phone.getByRole("button", { name: "Send to desktop" }).click();
  await desktop
    .getByRole("button", { name: "Charge Rs. 480.00", exact: true })
    .waitFor();
  await desktop.getByRole("button", { name: "Suppliers", exact: true }).click();
  await desktop
    .getByRole("button", { name: "Record purchase", exact: true })
    .click();
  await desktop
    .getByRole("button", { name: "Connect phone scanner", exact: true })
    .click();
  const purchaseLink = await desktop
    .getByRole("link", { name: "Open mobile scanner" })
    .getAttribute("href");
  await phone.goto(purchaseLink);
  await phone.reload();
  await phone
    .getByText("Phone camera → desktop purchase", { exact: true })
    .waitFor();
  await phone.getByLabel("Product code").fill("AYS-002");
  await phone.getByRole("button", { name: "Send to desktop" }).click();
  await phone
    .getByText("Red Raw Rice added to purchase.", { exact: true })
    .waitFor();
  assert.equal(
    await desktop
      .getByLabel("Red Raw Rice quantity", { exact: true })
      .inputValue(),
    "1",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: paired desktop QR, phone submission, repeated bill quantities and supplier purchase delivery with isolated test auth.",
  );
} finally {
  await browser.close();
}
