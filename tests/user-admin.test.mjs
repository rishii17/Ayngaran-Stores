import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApp } from "../server/app.mjs";
const adminId = "11111111-1111-4111-8111-111111111111";
const outsiderId = "22222222-2222-4222-8222-222222222222";
const listen = async (server) => {
  server.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  return `http://127.0.0.1:${server.address().port}`;
};
const close = (server) => new Promise((r) => server.close(r));
test("user creation requires verified authentication, a server allowlisted admin and server credentials", async () => {
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "AYNGARAN_ADMIN_USER_IDS",
  ];
  const before = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  const created = [];
  let duplicate = false;
  const upstream = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("X-Supabase-Api-Version", "2024-01-01");
    if (req.url === "/auth/v1/user") {
      if (req.headers.authorization === "Bearer invalid") {
        res.statusCode = 401;
        res.end(JSON.stringify({ message: "Invalid token" }));
        return;
      }
      const id =
        req.headers.authorization === "Bearer admin" ? adminId : outsiderId;
      // Forged client metadata must never confer privileges.
      res.end(
        JSON.stringify({
          id,
          email: "fixture@example.invalid",
          user_metadata: { role: "admin" },
          app_metadata: { role: "admin" },
        }),
      );
      return;
    }
    if (req.url === "/auth/v1/admin/users") {
      let text = "";
      for await (const chunk of req) text += chunk;
      created.push({
        body: JSON.parse(text),
        authorization: req.headers.authorization,
        apikey: req.headers.apikey,
      });
      if (duplicate) {
        res.statusCode = 422;
        res.end(
          JSON.stringify({ code: "email_exists", msg: "Already registered" }),
        );
        return;
      }
      res.end(
        JSON.stringify({
          id: "33333333-3333-4333-8333-333333333333",
          email: "new@example.invalid",
          encrypted_password: "must-not-leak",
        }),
      );
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = await listen(upstream);
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_local_test";
  process.env.AYNGARAN_ADMIN_USER_IDS = adminId;
  delete process.env.SUPABASE_SECRET_KEY;
  const service = createServer(createApp());
  const base = await listen(service);
  const payload = {
    name: "New User",
    email: "NEW@example.invalid",
    password: "safe-fixture-password-123",
  };
  const request = (token, body = payload) =>
    fetch(base + "/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await request()).status, 401);
    assert.equal((await request("invalid")).status, 401);
    assert.equal((await request("regular")).status, 403);
    const caps = await fetch(base + "/api/admin/capabilities", {
      headers: { Authorization: "Bearer regular" },
    });
    assert.deepEqual(await caps.json(), {
      canManageUsers: false,
      configured: false,
    });
    assert.equal((await request("admin")).status, 503);
    assert.equal(created.length, 0);
    process.env.SUPABASE_SECRET_KEY = "sb_secret_local_admin_test_only";
    assert.equal(
      (await request("admin", { ...payload, app_metadata: { role: "admin" } }))
        .status,
      400,
    );
    assert.equal(
      (await request("admin", { ...payload, password: "short" })).status,
      400,
    );
    const response = await request("admin");
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      user: {
        id: "33333333-3333-4333-8333-333333333333",
        email: "new@example.invalid",
      },
    });
    assert.equal(created.length, 1);
    assert.equal(created[0].body.email, "new@example.invalid");
    assert.equal(created[0].body.email_confirm, true);
    assert.deepEqual(created[0].body.user_metadata, { name: "New User" });
    assert.equal(created[0].body.app_metadata, undefined);
    assert.equal(created[0].apikey, process.env.SUPABASE_SECRET_KEY);
    assert.notEqual(created[0].authorization, "Bearer admin");
    duplicate = true;
    assert.equal((await request("admin")).status, 409);
    let limited;
    for (let i = 0; i < 10; i++) {
      limited = await request("admin", { ...payload, password: "short" });
      if (limited.status === 429) break;
    }
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.has("retry-after"));
    delete process.env.AYNGARAN_ADMIN_USER_IDS;
    assert.equal((await request("admin")).status, 403);
  } finally {
    await close(service);
    await close(upstream);
    for (const [name, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
