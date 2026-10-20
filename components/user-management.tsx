"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/client";

export default function UserManagement() {
  const [available, setAvailable] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    api("admin/capabilities")
      .then((data) => {
        if (active) {
          setAvailable(data.canManageUsers === true);
          setConfigured(data.configured === true);
        }
      })
      .catch(() => {
        if (active) setAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);
  if (!available) return null;
  return (
    <section className="panel" aria-label="User management">
      <div className="panel-heading">
        <div>
          <h2>Create user</h2>
          <p>Administrator access only</p>
        </div>
      </div>
      <form
        className="settings-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !configured) return;
          const form = event.currentTarget;
          const data = new FormData(form);
          setBusy(true);
          setError("");
          setMessage("");
          try {
            const result = await api("admin/users", {
              method: "POST",
              body: JSON.stringify({
                name: String(data.get("name")).trim(),
                email: String(data.get("email")).trim(),
                password: String(data.get("password")),
              }),
            });
            form.reset();
            setMessage(
              `User ${result.user.email} created. They can sign in with the password you provided.`,
            );
          } catch (error: any) {
            setError(error.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          New users have their own store. Creating an account does not grant
          administrator privileges.
        </p>
        {!configured && (
          <p role="alert" className="alert">
            User creation needs the server’s Supabase secret key. Ask the
            hosting administrator to configure it.
          </p>
        )}
        <label>
          Name
          <input name="name" autoComplete="off" maxLength={120} required />
        </label>
        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete="off"
            maxLength={254}
            required
          />
        </label>
        <label>
          Initial password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <p className="muted">
          Use at least 12 characters and share the password privately with the
          user.
        </p>
        {error && (
          <div role="alert" className="alert">
            {error}
          </div>
        )}
        {message && (
          <p role="status" className="positive">
            {message}
          </p>
        )}
        <button className="primary wide" disabled={busy || !configured}>
          {busy ? "Creating user…" : "Create user"}
        </button>
      </form>
    </section>
  );
}
