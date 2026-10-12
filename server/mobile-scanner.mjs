import { randomBytes, randomUUID } from "node:crypto";
import { Router } from "express";
// Ephemeral capabilities deliberately grant scan submission only, never account access.
export function scannerService({ now = Date.now } = {}) {
  const sessions = new Map();
  const prune = () => {
    for (const [id, s] of sessions) if (s.expires <= now()) sessions.delete(id);
  };
  function session(id) {
    prune();
    const s = sessions.get(id);
    if (!s)
      throw Error(
        "Pairing expired or disconnected. Pair again on the desktop.",
      );
    return s;
  }
  return {
    create(owner, target) {
      prune();
      for (const [id, s] of sessions)
        if (s.owner === owner) sessions.delete(id);
      if (sessions.size >= 1000)
        throw Error("Scanner capacity reached. Try later.");
      const id = randomUUID(),
        token = randomBytes(32).toString("hex"),
        expires = now() + 3600000;
      sessions.set(id, {
        owner,
        target,
        token,
        expires,
        events: [],
        seen: new Map(),
      });
      return { id, token, expires, target };
    },
    phone(id, token) {
      const s = session(id);
      if (typeof token !== "string" || token !== s.token)
        throw Error("Invalid pairing. Scan the desktop pairing QR again.");
      return s;
    },
    owner(id, owner) {
      const s = session(id);
      if (s.owner !== owner)
        throw Error("Pairing does not belong to this account.");
      return s;
    },
    submit(id, token, eventId, code) {
      const s = this.phone(id, token);
      if (
        !/^[a-f0-9-]{36}$/i.test(eventId) ||
        typeof code !== "string" ||
        !code.trim() ||
        code.length > 500
      )
        throw Error("Enter a valid product code (up to 500 characters).");
      if (s.seen.has(eventId)) return s.seen.get(eventId);
      if (s.events.length >= 50)
        throw Error(
          "Desktop queue is full. Keep the desktop pairing panel open.",
        );
      if (s.seen.size >= 5000)
        throw Error("Session scan limit reached. Pair again.");
      const event = { id: eventId, code: code.trim(), status: "queued" };
      s.events.push(event);
      s.seen.set(eventId, event);
      return event;
    },
    ack(id, owner, eventId, message) {
      const s = this.owner(id, owner),
        event = s.seen.get(eventId);
      if (event) {
        event.status = "received";
        event.message = String(message).slice(0, 200);
        s.events = s.events.filter((e) => e.id !== eventId);
      }
      return { ok: true };
    },
    remove(id, owner) {
      this.owner(id, owner);
      sessions.delete(id);
      return { ok: true };
    },
  };
}
export function scannerRoutes(service, authenticated = false) {
  const router = Router();
  const run = (fn) => (req, res) => {
    try {
      res.json(fn(req));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  };
  if (authenticated) {
    router.post(
      "/",
      run((req) =>
        service.create(
          req.user.id,
          req.body.target === "purchase" ? "purchase" : "bill",
        ),
      ),
    );
    router.get(
      "/:id",
      run((req) => {
        const s = service.owner(req.params.id, req.user.id);
        return { events: s.events, expires: s.expires };
      }),
    );
    router.post(
      "/:id/ack",
      run((req) =>
        service.ack(req.params.id, req.user.id, req.body.id, req.body.message),
      ),
    );
    router.delete(
      "/:id",
      run((req) => service.remove(req.params.id, req.user.id)),
    );
  } else {
    router.get(
      "/:id",
      run((req) => {
        const s = service.phone(req.params.id, req.headers["x-scanner-token"]);
        const event = req.query.event ? s.seen.get(req.query.event) : undefined;
        return { target: s.target, expires: s.expires, event };
      }),
    );
    router.post(
      "/:id",
      run((req) =>
        service.submit(
          req.params.id,
          req.headers["x-scanner-token"],
          req.body.id,
          req.body.code,
        ),
      ),
    );
  }
  return router;
}
