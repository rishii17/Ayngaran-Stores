"use client";
import { useState } from "react";
import { getSupabase } from "../lib/client";
import { authErrorMessage } from "../lib/auth-error.mjs";
import { GaneshMark } from "./product-art";

export default function LoginForm({
  onSignedIn,
  notice = "",
}: {
  onSignedIn: (user: any) => Promise<void>;
  notice?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const sb = getSupabase();
        if (!sb) {
          setError(
            "Store sign-in is not configured yet. Contact the store administrator.",
          );
          return;
        }
        const data = new FormData(event.currentTarget);
        setBusy(true);
        setError("");
        try {
          const result = await sb.auth.signInWithPassword({
            email: String(data.get("email")).trim(),
            password: String(data.get("password")),
          });
          if (result.error) throw result.error;
          if (!result.data.user || !result.data.session)
            throw new Error("Sign-in could not be completed. Please retry.");
          await onSignedIn(result.data.user);
        } catch (error: any) {
          setError(authErrorMessage(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="auth-intro">
        <span className="brand-mark">
          <GaneshMark />
        </span>
        <h1>Sign in to Ayngaran Stores</h1>
        <p>Use the account provided by your administrator.</p>
      </div>
      {(error || notice) && (
        <div role="alert" className="alert">
          {error || notice}
        </div>
      )}
      <label>
        Email
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button className="primary wide" disabled={busy}>
        {busy ? "Signing in…" : "Sign in to live store"}
      </button>
    </form>
  );
}
