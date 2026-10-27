import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { applyAction } from "../lib/domain.mjs";
import { loadStore, commitStore } from "./store-repository.mjs";
import { registerUserAdmin } from "./user-admin.mjs";
import { createBackup, validDate } from "../lib/backup.mjs";
const text = z.string().max(500),
  num = z.number().finite();
const discountFields = {
  discountType: z.enum(["amount", "percent"]).optional(),
  discountValue: num.nonnegative().optional(),
};
const saleLine = z.object({
  productId: z.string(),
  quantity: num.positive(),
  ...discountFields,
});
const product = z.object({
  ...discountFields,
  id: z.string().optional(),
  name: text.min(1),
  tamil: text.default(""),
  category: text,
  sku: text,
  barcode: text,
  price: num.positive(),
  cost: num.nonnegative(),
  stock: num.nonnegative(),
  unit: text,
  reorder: num.nonnegative(),
  art: text.default("rice"),
  image: z
    .string()
    .max(700000)
    .refine(
      (v) => !v || /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(v),
      "Only compressed WebP images accepted",
    )
    .default(""),
});
const contact = z.object({
  id: z.string().optional(),
  name: text.min(1),
  phone: text,
  address: text,
  village: text.optional().default(""),
  openingBalance: num.nonnegative().default(0),
  creditLimit: num.nonnegative().optional(),
});
const paymentMethod = z.enum(["cash", "bank"]).optional();
const schemas = {
  openDrawer: z.object({ amount: num.nonnegative(), note: text.default("") }),
  closeDrawer: z.object({
    sessionId: z.string().min(1),
    amount: num.nonnegative(),
    note: text.default(""),
  }),
  drawerMovement: z.object({
    amount: num.positive(),
    direction: z.enum(["in", "out"]),
    note: text.min(1),
  }),
  customerCredit: z.object({
    customerId: z.string().min(1),
    amount: num.positive(),
    source: z.enum(["drawer", "external"]),
    note: text.min(1),
  }),
  seed: z.object({ confirm: z.literal("LOAD DUMMY DATA") }),
  price: z.object({
    productId: z.string(),
    price: num.positive(),
    cost: num.nonnegative(),
    reason: text.min(1),
  }),
  product,
  deleteProduct: z.object({
    productId: text.min(1),
    confirm: z.literal("DELETE"),
  }),
  customer: contact.extend({ creditLimit: num.nonnegative() }),
  supplier: contact,
  supplierSchedule: z.object({
    supplierId: z.string().min(1),
    paymentDueDate: z.string().max(10).optional(),
    nextChequeDate: z.string().max(10).optional(),
    lastVisitDate: z.string().max(10).optional(),
    nextVisitDate: z.string().max(10).optional(),
    payOnNextVisit: z.boolean().optional(),
    chequeAmount: num.nonnegative().optional(),
    chequeReference: text.optional(),
  }),
  checkout: z.object({
    items: z.array(saleLine).min(1).max(500),
    customerId: z.string().nullable().optional(),
    method: z.enum(["cash", "card", "credit"]),
    discount: num.nonnegative(),
    tendered: num.nonnegative(),
    heldId: z.string().nullable().optional(),
  }),
  payment: z.object({
    paymentMethod,
    customerId: z.string().optional(),
    supplierId: z.string().optional(),
    amount: num.positive(),
    note: text.default(""),
  }),
  purchase: z.union([
    z.object({
      paymentMethod,
      supplierId: z.string().min(1),
      items: z
        .array(
          z.object({
            productId: z.string().min(1),
            quantity: num.positive(),
            cost: num.positive(),
            sellingPrice: num.positive().optional(),
          }),
        )
        .min(1)
        .max(500),
      paid: num.nonnegative(),
      reference: text.default(""),
    }),
    z.object({
      paymentMethod,
      supplierId: z.string().min(1),
      productId: z.string().min(1),
      quantity: num.positive(),
      cost: num.positive(),
      sellingPrice: num.positive().optional(),
      paid: num.nonnegative(),
      reference: text.default(""),
    }),
  ]),
  adjust: z.object({
    productId: z.string(),
    quantity: num,
    reason: text.min(1),
  }),
  hold: z.object({
    items: z.array(saleLine).min(1),
    customerId: z.string().nullable().optional(),
    discount: num.nonnegative(),
    label: text,
  }),
  deleteHold: z.object({ id: z.string() }),
  void: z.object({ id: z.string(), reason: text.min(1) }),
  settings: z.object({
    name: text.min(1),
    address: text,
    phone: text,
    currency: z.literal("LKR"),
    receiptNote: text,
    taxRate: num.min(0).max(100),
  }),
};
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 180,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      // Next adds forwarded headers. Keep socket-based limiting rather than
      // trusting client-supplied forwarding headers on arbitrary hosts.
      validate: { xForwardedForHeader: false },
    }),
  );
  app.get("/api/health", (_, res) =>
    res.json({
      ok: true,
      configured: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      ),
    }),
  );
  app.use("/api", async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer /, "");
      if (!token)
        return res.status(401).json({ error: "Please sign in to your store" });
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
        key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key)
        return res
          .status(503)
          .json({ error: "Supabase configuration is missing" });
      req.db = createClient(url, key, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await req.db.auth.getUser(token);
      if (error || !data.user)
        return res
          .status(401)
          .json({ error: "Your session expired. Sign in again." });
      req.user = data.user;
      next();
    } catch (e) {
      next(e);
    }
  });
  registerUserAdmin(app);
  async function load(req) {
    return loadStore(req.db, req.user.id);
  }
  app.get("/api/state", async (req, res, next) => {
    try {
      res.json(await load(req));
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/backup", async (req, res, next) => {
    try {
      const date = validDate(String(req.query.date || ""));
      const { state } = await load(req);
      const bytes = await createBackup(state, date, "live");
      res.set({
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ayngaran-live-${date}.xlsx"`,
        "Cache-Control": "no-store",
      });
      res.send(Buffer.from(bytes));
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/connection", async (req, res, next) => {
    try {
      const store = await load(req);
      res.json({
        authenticated: true,
        database: true,
        storageVersion: store.storageVersion,
        revision: store.revision,
        ownerId: req.user.id,
      });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/actions", async (req, res, next) => {
    try {
      const envelope = z
        .object({
          id: z.uuid(),
          type: z.enum(Object.keys(schemas)),
          payload: z.unknown(),
        })
        .parse(req.body);
      if (
        envelope.type === "seed" &&
        process.env.NEXT_PUBLIC_ENABLE_SAMPLE_MODE !== "true"
      ) {
        return res
          .status(403)
          .json({ error: "Sample data import is disabled in this release" });
      }
      const payload = schemas[envelope.type].parse(envelope.payload);
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = await load(req);
        const prior = await req.db
          .from("ayngaran_requests")
          .select("result")
          .eq("owner_id", req.user.id)
          .eq("request_id", envelope.id)
          .maybeSingle();
        if (prior.error) throw prior.error;
        if (prior.data)
          return res.json({ ...(await load(req)), result: prior.data.result });
        let seedTemplate;
        if (envelope.type === "seed") {
          const template = await req.db
            .from("ayngaran_seed_templates")
            .select("state")
            .eq("name", "grocery-v1")
            .single();
          if (template.error) throw template.error;
          seedTemplate = template.data.state;
        }
        const changed = applyAction(current.state, {
          seedTemplate,
          type: envelope.type,
          payload,
        });
        const data = await commitStore(
          req.db,
          current,
          envelope.id,
          changed,
          envelope.type,
        );
        if (!data.conflict) return res.json(data);
      }
      res
        .status(409)
        .json({ error: "Store changed while saving. Please retry." });
    } catch (e) {
      next(e);
    }
  });
  app.use((error, req, res, next) => {
    if (error instanceof z.ZodError)
      return res
        .status(400)
        .json({ error: error.issues.map((x) => x.message).join("; ") });
    if (error.type === "entity.parse.failed")
      return res.status(400).json({ error: "Invalid JSON request" });
    if (error.type === "entity.too.large")
      return res.status(413).json({ error: "Request exceeds the 1 MB limit" });
    console.error(
      "POS request failed:",
      error.code || error.name || "RequestError",
    );
    res.status(error.code ? 503 : 400).json({
      error: error.code
        ? "Database operation failed. Check configuration and try again."
        : error.message || "Request failed",
    });
  });
  return app;
}
