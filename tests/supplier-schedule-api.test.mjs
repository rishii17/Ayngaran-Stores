import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { seedState, supplierBalance } from "../lib/domain.mjs";
import { createApp } from "../server/app.mjs";
const listen = async (server) => {
  server.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return `http://127.0.0.1:${server.address().port}`;
};
const close = (server) => new Promise((resolve) => server.close(resolve));
test("supplier scheduling API validates dates and preserves reminders when contact details change", async () => {
  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
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
    if (path === "/rest/v1/ayngaran_requests") return res.end("null");
    if (path === "/rest/v1/rpc/ayngaran_commit") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const payload = JSON.parse(raw);
      state = payload.p_state;
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
    const action = (type, payload) =>
      fetch(`${base}/api/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer local-test-only",
        },
        body: JSON.stringify({ id: crypto.randomUUID(), type, payload }),
      });
    const supplier = state.suppliers[0];
    const before = supplierBalance(state, supplier.id);
    const plan = {
      supplierId: supplier.id,
      paymentDueDate: "2026-11-01",
      nextChequeDate: "2026-11-02",
      chequeAmount: 100,
      chequeReference: "CH-01",
      lastVisitDate: "2026-01-01",
      nextVisitDate: "2026-11-03",
      payOnNextVisit: true,
    };
    let response = await action("supplierSchedule", plan);
    assert.equal(response.status, 200, await response.text());
    assert.equal(state.suppliers[0].chequeReference, "CH-01");
    assert.equal(state.suppliers[0].payOnNextVisit, true);
    assert.equal(supplierBalance(state, supplier.id), before);
    assert.equal(state.payments.length, 0);
    response = await action("supplier", {
      ...supplier,
      name: "Renamed company",
    });
    assert.equal(response.status, 200, await response.text());
    assert.equal(state.suppliers[0].nextChequeDate, "2026-11-02");
    const saved = structuredClone(state);
    for (const extra of [
      { paymentDueDate: "2026-02-30" },
      { chequeAmount: -1 },
      { payOnNextVisit: "yes" },
      { nextVisitDate: "", payOnNextVisit: true },
      { lastVisitDate: "2099-01-01" },
      { supplierId: "other-owner-supplier" },
    ]) {
      response = await action("supplierSchedule", { ...plan, ...extra });
      assert.equal(response.status, 400);
      assert.deepEqual(state, saved);
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
