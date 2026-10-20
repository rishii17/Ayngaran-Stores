import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { seedState, emptyState } from "../../lib/domain.mjs";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const base = process.env.POS_TEST_URL || "http://localhost:3000";
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const old = seedState();
  await page.addInitScript((state) => {
    localStorage.setItem(
      "ayngaran-demo-v1",
      JSON.stringify({ state, receipts: {} }),
    );
    localStorage.setItem("ayngaran-mode", "demo");
  }, old);
  const response = await page.goto(base);
  assert.equal(response.status(), 200);
  assert.equal(response.headers()["x-powered-by"], undefined);
  assert.equal(response.headers()["x-content-type-options"], "nosniff");
  assert.equal(response.headers()["x-frame-options"], "DENY");
  await page
    .getByRole("button", { name: "Sign in to live store", exact: true })
    .waitFor();
  assert.equal(await page.locator(".app-shell").count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: /Create.*account|register/i })
      .count(),
    0,
  );
  assert.equal(await page.locator(".demo-banner").count(), 0);
  assert.equal(await page.locator(".product-card").count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Load supplier sample list", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Toggle navigation", exact: true })
      .count(),
    0,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Sign in to live store", exact: true })
      .isVisible(),
    true,
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  const retained = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("ayngaran-demo-v1")).state.products
        .length,
  );
  assert.equal(
    retained,
    16,
    "Old local sample records remain preserved but never displayed in production",
  );
  const health = await page.request.get(base + "/api/health");
  assert.equal((await health.json()).ok, true);
  for (const path of ["state", "connection", "backup?date=2026-10-20"]) {
    const r = await page.request.get(base + "/api/" + path);
    assert.equal(r.status(), 401);
    assert.match(r.headers()["content-type"], /json/);
    assert.equal(r.headers()["cache-control"], "no-store");
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: production opens sign-in with no sample products/loaders, ignores old demo storage, preserves backups, and denies unauthenticated API access.",
  );
  const authURL = process.env.PRODUCTION_TEST_SUPABASE_URL;
  if (authURL) {
    const authenticated = await browser.newPage();
    const state = emptyState();
    state.customers = [
      {
        id: "b",
        name: "Beta Owner Customer",
        village: "Hopton",
        address: "",
        phone: "0772",
        openingBalance: 90,
        creditLimit: 300,
      },
      {
        id: "a",
        name: "Alpha Owner Customer",
        village: "",
        address: "",
        phone: "0771",
        openingBalance: 20,
        creditLimit: 100,
      },
    ];
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      aud: "authenticated",
      role: "authenticated",
      email: "owner@example.invalid",
      created_at: "2026-01-01T00:00:00Z",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
    };
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const token =
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
        "base64url",
      ) +
      "." +
      Buffer.from(
        JSON.stringify({ sub: user.id, exp: expiry, role: "authenticated" }),
      ).toString("base64url") +
      ".local-test-signature";
    const storageKey = `sb-${new URL(authURL).hostname.split(".")[0]}-auth-token`;
    await authenticated.addInitScript(
      ({ storageKey, session }) =>
        localStorage.setItem(storageKey, JSON.stringify(session)),
      {
        storageKey,
        session: {
          access_token: token,
          refresh_token: "local-test-refresh",
          expires_in: 3600,
          expires_at: expiry,
          token_type: "bearer",
          user,
        },
      },
    );
    await authenticated.route(authURL + "/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(user),
      }),
    );
    await authenticated.route("**/api/admin/capabilities", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ canManageUsers: false, configured: false }),
      }),
    );
    await authenticated.route("**/api/state", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ state, revision: 1 }),
      }),
    );
    await authenticated.goto(base);
    await authenticated
      .getByRole("button", { name: "Toggle navigation", exact: true })
      .click();
    await authenticated
      .getByRole("button", { name: "Customers", exact: true })
      .click();
    await authenticated
      .getByText("Alpha Owner Customer", { exact: true })
      .waitFor();
    const sort = authenticated.getByRole("combobox", {
      name: "Sort customers",
    });
    await sort.selectOption("balance-desc");
    assert.deepEqual(
      await authenticated
        .locator("tbody .person-cell strong")
        .allTextContents(),
      ["Beta Owner Customer", "Alpha Owner Customer"],
    );
    assert.equal(await authenticated.locator(".demo-banner").count(), 0);
    await authenticated
      .getByRole("button", { name: "Toggle navigation", exact: true })
      .click();
    await authenticated
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    assert.equal(
      await authenticated
        .getByRole("region", { name: "User management", exact: true })
        .count(),
      0,
      "Ordinary users cannot see account creation",
    );
    await authenticated.unroute("**/api/admin/capabilities");
    await authenticated.route("**/api/admin/capabilities", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ canManageUsers: true, configured: true }),
      }),
    );
    await authenticated
      .getByRole("button", { name: "Toggle navigation", exact: true })
      .click();
    await authenticated
      .getByRole("button", { name: "Point of sale", exact: true })
      .click();
    await authenticated
      .getByRole("button", { name: "Toggle navigation", exact: true })
      .click();
    await authenticated
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    const management = authenticated.getByRole("region", {
      name: "User management",
      exact: true,
    });
    await management.waitFor();
    let created = 0;
    await authenticated.route("**/api/admin/users", async (route) => {
      const body = route.request().postDataJSON();
      assert.equal(body.name, "New User");
      assert.equal(body.email, "new@example.invalid");
      assert.ok(body.password.length >= 12);
      created++;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "new-user", email: "new@example.invalid" },
        }),
      });
    });
    await management.getByLabel("Name", { exact: true }).fill("New User");
    await management
      .getByLabel("Email", { exact: true })
      .fill("new@example.invalid");
    await management
      .getByLabel("Initial password", { exact: true })
      .fill("fixture-password-123");
    await management
      .getByRole("button", { name: "Create user", exact: true })
      .click();
    await management.getByRole("status").waitFor();
    assert.equal(created, 1);
    assert.equal(
      await management
        .getByLabel("Initial password", { exact: true })
        .inputValue(),
      "",
    );
    await authenticated
      .getByRole("button", { name: "Manage account", exact: true })
      .click();
    await authenticated.getByText(user.email, { exact: true }).waitFor();
    await authenticated.route(authURL + "/auth/v1/logout**", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: "Sign-out test failure" }),
      }),
    );
    await authenticated
      .getByRole("button", { name: "Sign out", exact: true })
      .click();
    await authenticated
      .getByRole("alert")
      .filter({ hasText: "Sign-out test failure" })
      .waitFor();
    await authenticated
      .getByRole("button", { name: "Sign in to live store", exact: true })
      .waitFor();
    assert.equal(
      await authenticated.evaluate(
        (key) => localStorage.getItem(key),
        storageKey,
      ),
      null,
    );
    assert.equal(
      await authenticated.locator(".app-shell").count(),
      0,
      "Signed-out visitors cannot inspect the store interface",
    );
    assert.equal(
      await authenticated
        .getByText("Alpha Owner Customer", { exact: true })
        .count(),
      0,
    );
    await authenticated.unroute(authURL + "/auth/v1/logout**");
    // Reload reapplies this page's isolated session fixture for the success case.
    await authenticated.reload();
    await authenticated
      .getByRole("button", { name: "Toggle navigation", exact: true })
      .click();
    await authenticated
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await authenticated
      .getByRole("button", { name: "Manage account", exact: true })
      .click();
    await authenticated
      .getByRole("button", { name: "Sign out", exact: true })
      .click();
    await authenticated
      .getByRole("button", { name: "Sign in to live store", exact: true })
      .waitFor();
    assert.equal(await authenticated.locator(".demo-banner").count(), 0);
    console.log(
      "PASS: production session restoration, customer sorting, admin-only user creation preserving the current session, and sign-out cleanup with mocked authentication/API (no live database writes).",
    );
  }
} finally {
  await browser.close();
}
