import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApp } from "../server/app.mjs";
const listen = async (server) => {
  server.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return `http://127.0.0.1:${server.address().port}`;
};
const close = (server) => new Promise((resolve) => server.close(resolve));
test("API rejects malformed/oversized JSON without exposing request content and denies unauthenticated writes", async () => {
  const server = createApp();
  const http = createServer(server);
  const base = await listen(http);
  try {
    const malformed = await fetch(`${base}/api/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"private":"do-not-reflect", invalid',
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: "Invalid JSON request" });
    const large = await fetch(`${base}/api/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "a".repeat(1024 * 1024) }),
    });
    assert.equal(large.status, 413);
    assert.doesNotMatch(await large.text(), /aaaaa/);
    const rejected = await fetch(`${base}/api/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://untrusted.example",
      },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        type: "settings",
        payload: {},
      }),
    });
    assert.equal(rejected.status, 401);
    assert.equal(rejected.headers.get("access-control-allow-origin"), null);
    assert.equal(rejected.headers.get("cache-control"), "no-store");
    assert.equal(rejected.headers.get("x-powered-by"), null);
  } finally {
    await close(http);
  }
});
test("production seed import is blocked even with an authenticated request", async () => {
  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    sample: process.env.NEXT_PUBLIC_ENABLE_SAMPLE_MODE,
  };
  let requests = 0;
  const auth = createServer((req, res) => {
    requests++;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        id: "11111111-1111-4111-8111-111111111111",
        aud: "authenticated",
        role: "authenticated",
        email: "test@example.invalid",
      }),
    );
  });
  const authBase = await listen(auth);
  process.env.NEXT_PUBLIC_SUPABASE_URL = authBase;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "local-test-only";
  delete process.env.NEXT_PUBLIC_ENABLE_SAMPLE_MODE;
  const http = createServer(createApp());
  const base = await listen(http);
  try {
    const response = await fetch(`${base}/api/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer local-test-only",
      },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        type: "seed",
        payload: { confirm: "LOAD DUMMY DATA" },
      }),
    });
    assert.equal(response.status, 403);
    assert.equal(requests, 1);
    assert.match((await response.json()).error, /disabled/);
  } finally {
    await close(http);
    await close(auth);
    for (const [name, value] of Object.entries({
      NEXT_PUBLIC_SUPABASE_URL: previous.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: previous.key,
      NEXT_PUBLIC_ENABLE_SAMPLE_MODE: previous.sample,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
test("rate limiting blocks sustained requests and supplies retry information", async () => {
  const http = createServer(createApp());
  const base = await listen(http);
  try {
    let last;
    for (let i = 0; i < 181; i++) last = await fetch(`${base}/api/health`);
    assert.equal(last.status, 429);
    assert.ok(last.headers.has("retry-after"));
  } finally {
    await close(http);
  }
});
