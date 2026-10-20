import { createClient } from "@supabase/supabase-js";
import rateLimit from "express-rate-limit";
import { z } from "zod";

export function isUserAdministrator(userId) {
  return (process.env.AYNGARAN_ADMIN_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(userId);
}
const input = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z
      .email()
      .max(254)
      .transform((email) => email.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();

export function registerUserAdmin(app) {
  // Mounted after the normal getUser verification. Never trust client metadata.
  app.get("/api/admin/capabilities", (req, res) => {
    const allowed = isUserAdministrator(req.user.id);
    res.json({
      canManageUsers: allowed,
      configured: allowed && Boolean(process.env.SUPABASE_SECRET_KEY),
    });
  });
  app.post(
    "/api/admin/users",
    (req, res, next) => {
      if (!isUserAdministrator(req.user.id))
        return res.status(403).json({
          error: "Only the configured administrator can create users",
        });
      next();
    },
    rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: 10,
      keyGenerator: (req) => req.user.id,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    async (req, res, next) => {
      try {
        const payload = input.parse(req.body);
        const key = process.env.SUPABASE_SECRET_KEY;
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!key || !url)
          return res
            .status(503)
            .json({ error: "User creation is not configured on this server" });
        const admin = createClient(url, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        });
        const { data, error } = await admin.auth.admin.createUser({
          email: payload.email,
          password: payload.password,
          email_confirm: true,
          user_metadata: { name: payload.name },
        });
        if (error || !data.user) {
          if (["email_exists", "user_already_exists"].includes(error?.code))
            return res.status(409).json({
              error:
                "This email may already be registered. Check the user list in Supabase.",
            });
          if (error?.code === "weak_password")
            return res
              .status(400)
              .json({
                error:
                  "Use a stronger password that meets the store's password policy",
              });
          return res.status(502).json({
            error:
              "User creation failed. Check the server's Supabase configuration and retry.",
          });
        }
        res
          .status(201)
          .json({ user: { id: data.user.id, email: data.user.email } });
      } catch (error) {
        next(error);
      }
    },
  );
}
