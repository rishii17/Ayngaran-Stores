import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { seedState } from "../lib/domain.mjs";
import { createApp } from "../server/app.mjs";
const listen = async (server) => {
  server.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return `http://127.0.0.1:${server.address().port}`;
};
const close = (server) => new Promise((resolve) => server.close(resolve));
test("authenticated API retains product/line discounts and rejects invalid values before saving", async () => {
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
    const product = state.products[0];
    let response = await action("product", {
      ...product,
      discountType: "percent",
      discountValue: 10,
    });
    assert.equal(response.status, 200, await response.text());
    assert.equal(state.products[0].discountValue, 10);
    response = await action("hold", {
      items: [
        {
          productId: product.id,
          quantity: 2,
          discountType: "amount",
          discountValue: 5,
        },
      ],
      discount: 2,
      label: "Later",
    });
    assert.equal(response.status, 200, await response.text());
    const held = state.held[0];
    assert.equal(held.items[0].discountValue, 5);
    response = await action("checkout", {
      items: held.items,
      discount: 2,
      heldId: held.id,
      method: "cash",
      tendered: 500,
    });
    assert.equal(response.status, 200);
    const sale = (await response.json()).result;
    assert.equal(sale.subtotal, 480);
    assert.equal(sale.discount, 12);
    assert.equal(sale.total, 468);
    assert.equal(sale.items[0].price, 240);
    assert.equal(sale.items[0].discountValue, 5);
    assert.equal(state.held.length, 0);
    const before = structuredClone(state);
    for (const discount of [
      { discountType: "percent", discountValue: 101 },
      { discountType: "invalid", discountValue: 5 },
    ]) {
      response = await action("checkout", {
        items: [{ productId: product.id, quantity: 1, ...discount }],
        discount: 0,
        method: "cash",
        tendered: 500,
      });
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
