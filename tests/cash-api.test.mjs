import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { seedState, customerBalance } from "../lib/domain.mjs";
import { createApp } from "../server/app.mjs";
const listen = async (server) => {
  server.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return `http://127.0.0.1:${server.address().port}`;
};
const close = (server) => new Promise((resolve) => server.close(resolve));
test("cash APIs require authentication, preserve drawer events and replay loans idempotently", async () => {
  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
  const requests = new Map();
  let state = seedState(),
    revision = 0;
  const fake = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    const path = new URL(req.url, "http://localhost").pathname;
    if (path === "/auth/v1/user")
      return res.end(
        JSON.stringify({
          id: "11111111-1111-4111-8111-111111111111",
          aud: "authenticated",
          role: "authenticated",
        }),
      );
    if (path === "/rest/v1/rpc/ayngaran_load_v2") {
      res.statusCode = 404;
      return res.end(
        JSON.stringify({ code: "PGRST202", message: "Local legacy fixture" }),
      );
    }
    if (path === "/rest/v1/ayngaran_stores")
      return res.end(JSON.stringify({ state, revision }));
    if (path === "/rest/v1/ayngaran_requests")
      return res.end(
        JSON.stringify(
          requests.get(
            new URL(req.url, "http://localhost").searchParams
              .get("request_id")
              ?.replace(/^eq\./, ""),
          ) || null,
        ),
      );
    if (path === "/rest/v1/rpc/ayngaran_commit") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const payload = JSON.parse(raw);
      state = payload.p_state;
      requests.set(payload.p_request_id, { result: payload.p_result });
      revision++;
      return res.end(
        JSON.stringify({ state, revision, result: payload.p_result }),
      );
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Unexpected fixture path" }));
  });
  const url = await listen(fake);
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "local-test-only";
  const server = createServer(createApp());
  try {
    const base = await listen(server);
    const action = (type, payload, id = crypto.randomUUID()) =>
      fetch(`${base}/api/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer local-test-only",
        },
        body: JSON.stringify({ id, type, payload }),
      });
    const customerId = state.customers[0].id;
    const originalBalance = customerBalance(state, customerId);
    const unauthorized = await fetch(`${base}/api/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        type: "customerCredit",
        payload: { customerId, amount: 100, source: "drawer", note: "Loan" },
      }),
    });
    assert.equal(unauthorized.status, 401);
    let response = await action("openDrawer", { amount: 1000 });
    assert.equal(response.status, 200, await response.text());
    const sessionId = state.cashSessions[0].id;
    const id = crypto.randomUUID();
    const credit = {
      customerId,
      amount: 100,
      source: "drawer",
      note: "Cash loan",
    };
    response = await action("customerCredit", credit, id);
    assert.equal(response.status, 200, await response.text());
    response = await action("customerCredit", credit, id);
    assert.equal(response.status, 200, await response.text());
    assert.equal(state.customerCredits.length, 1);
    assert.equal(state.cashMovements.length, 1);
    assert.equal(state.sales.length, 0);
    assert.equal(customerBalance(state, customerId), originalBalance + 100);
    response = await action("payment", {
      customerId,
      amount: 20,
      paymentMethod: "bank",
      note: "Bank collection",
    });
    assert.equal(response.status, 200, await response.text());
    assert.equal(state.cashMovements.length, 1);
    response = await action("closeDrawer", { sessionId, amount: 900 });
    assert.equal(response.status, 200, await response.text());
    assert.equal(state.cashSessions[0].closingSummary.expected, 900);
    const before = structuredClone(state);
    for (const payload of [
      { ...credit, source: "bad" },
      { ...credit, amount: -1 },
      { ...credit, amount: 0.001 },
    ]) {
      response = await action("customerCredit", payload);
      assert.equal(response.status, 400);
      assert.deepEqual(state, before);
    }
  } finally {
    await close(server);
    await close(fake);
    for (const [key, value] of [
      ["NEXT_PUBLIC_SUPABASE_URL", previous.url],
      ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", previous.key],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
