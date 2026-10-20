"use client";
import { useState } from "react";
import { Download, Database, CheckCircle2 } from "lucide-react";
import { excelBackup, api } from "@/lib/client";
import { sampleModeEnabled } from "../lib/runtime-config.mjs";
import { localDay } from "@/lib/reporting.mjs";
export default function BackupPanel({
  state,
  mode,
  onSeed,
}: {
  state: any;
  mode: "demo" | "live";
  onSeed: () => void;
}) {
  const [date, setDate] = useState(localDay(new Date().toISOString())),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Daily Excel backup</h2>
          <p>Download your daily report and full current store snapshot</p>
        </div>
        <Download size={20} />
      </div>
      <div className="settings-form">
        <label>
          Report date (Sri Lanka)
          <input
            aria-label="Excel backup date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <p>
          Includes bills, bill items, customer balances, suppliers, purchases,
          stock and price history. Balances and stock reflect the time of
          download.
        </p>
        <button
          className="primary wide"
          disabled={busy || !date}
          onClick={async () => {
            setBusy(true);
            setError("");
            setMessage("");
            try {
              await excelBackup(state, date, mode);
              setMessage(
                "Excel backup downloaded. Keep a copy outside this device.",
              );
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download size={17} />
          {busy ? "Preparing…" : "Download Excel backup"}
        </button>
        <p className="muted">
          Download at day-end. This does not schedule unattended backups.
        </p>
        {mode === "live" && (
          <button
            className="button wide"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await api("connection");
                setMessage(
                  `Signed in and connected to Supabase. Store revision ${r.revision}.`,
                );
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <CheckCircle2 size={17} />
            Check live connection
          </button>
        )}
        {sampleModeEnabled && (
          <button className="button wide" disabled={busy} onClick={onSeed}>
            <Database size={17} />
            Load dummy data into empty store
          </button>
        )}
        {message && (
          <p role="status" className="positive">
            {message}
          </p>
        )}
        {error && (
          <div role="alert" className="alert">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
