import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { scannerService, scannerRoutes } from "../server/mobile-scanner.mjs";
test("scanner capabilities isolate owners, deduplicate retries, enforce expiry and revoke", () => {
  let time = 1000;
  const service = scannerService({ now: () => time });
  const a = service.create("owner-a", "bill");
  assert.equal(a.token.length, 64);
  assert.throws(() => service.phone(a.id, "wrong"));
  assert.throws(() => service.owner(a.id, "owner-b"));
  const id = randomUUID();
  const first = service.submit(a.id, a.token, id, "  CODE-1  ");
  assert.equal(service.submit(a.id, a.token, id, "CODE-1"), first);
  assert.equal(service.owner(a.id, "owner-a").events.length, 1);
  assert.throws(() => service.ack(a.id, "owner-b", id, "Added"));
  service.ack(a.id, "owner-a", id, "Product added");
  assert.equal(first.status, "received");
  assert.equal(service.submit(a.id, a.token, id, "CODE-1").status, "received");
  assert.equal(service.owner(a.id, "owner-a").events.length, 0);
  assert.throws(() => service.submit(a.id, a.token, randomUUID(), ""));
  assert.throws(() =>
    service.submit(a.id, a.token, randomUUID(), "x".repeat(501)),
  );
  time += 3600001;
  assert.throws(() => service.phone(a.id, a.token));
  const b = service.create("owner-a", "purchase");
  const c = service.create("owner-a", "bill");
  assert.throws(() => service.phone(b.id, b.token));
  service.remove(c.id, "owner-a");
  assert.throws(() => service.phone(c.id, c.token));
});
test("scanner queue rejects overflow without dropping existing scans", () => {
  const service = scannerService(),
    p = service.create("a", "bill");
  for (let i = 0; i < 50; i++)
    service.submit(p.id, p.token, randomUUID(), "code");
  assert.throws(() => service.submit(p.id, p.token, randomUUID(), "code"));
  assert.equal(service.owner(p.id, "a").events.length, 50);
});
test("HTTP phone endpoint requires capability and cannot obtain owner queue", async () => {
  const service = scannerService(),
    app = express();
  app.use(express.json());
  app.use("/phone", scannerRoutes(service));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    const p = service.create("a", "purchase"),
      url = `http://127.0.0.1:${server.address().port}/phone/${p.id}`;
    assert.equal((await fetch(url)).status, 400);
    const data = await (
      await fetch(url, { headers: { "x-scanner-token": p.token } })
    ).json();
    assert.equal(data.target, "purchase");
    assert.equal(data.owner, undefined);
    assert.equal(data.token, undefined);
    const eventId = randomUUID();
    const result = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-scanner-token": p.token,
      },
      body: JSON.stringify({ id: eventId, code: "4790001000001" }),
    });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).status, "queued");
    service.ack(p.id, "a", eventId, "Received on desktop");
    const status = await (
      await fetch(url + "?event=" + eventId, {
        headers: { "x-scanner-token": p.token },
      })
    ).json();
    assert.equal(status.event.message, "Received on desktop");
  } finally {
    await new Promise((r) => server.close(r));
  }
});
