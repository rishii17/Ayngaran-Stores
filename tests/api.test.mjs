import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
test("API health and unauthorized data access", async () => {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const health = await fetch(base + "/api/health");
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);
    const state = await fetch(base + "/api/state");
    assert.equal(state.status, 401);
    const mutation = await fetch(base + "/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(mutation.status, 401);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
