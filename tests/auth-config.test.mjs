import test from "node:test";
import assert from "node:assert/strict";
import { authErrorMessage } from "../lib/auth-error.mjs";
test("invalid API key errors explain local config and rebuild without confusing user credentials", () => {
  const message = authErrorMessage({ message: "Invalid API key" });
  assert.match(message, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(message, /npm run build/);
  assert.match(message, /Never use a secret/);
  assert.equal(
    authErrorMessage({ message: "Invalid login credentials" }),
    "Invalid login credentials",
  );
});
