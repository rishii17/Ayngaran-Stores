"use client";
import { useEffect, useRef, useState } from "react";
import Scanner from "./scanner";
export default function MobileScanner() {
  const [pair, setPair] = useState<{ id: string; token: string } | null>(null),
    [target, setTarget] = useState(""),
    [camera, setCamera] = useState(false),
    [code, setCode] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [count, setCount] = useState(0);
  const [pairingLink, setPairingLink] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    const fragment = location.hash.slice(1);
    if (fragment) {
      sessionStorage.setItem("ayngaran-scanner-pair", fragment);
      history.replaceState(null, "", location.pathname);
    }
    const value = (
      fragment ||
      sessionStorage.getItem("ayngaran-scanner-pair") ||
      ""
    ).split(":");
    if (value.length === 2) {
      setPair({ id: value[0], token: value[1] });
      try {
        const saved = JSON.parse(
          sessionStorage.getItem("ayngaran-scanner-pending") || "null",
        );
        if (saved?.pairId === value[0]) setPending(saved.event);
        else sessionStorage.removeItem("ayngaran-scanner-pending");
      } catch {
        sessionStorage.removeItem("ayngaran-scanner-pending");
      }
    }
  }, []);
  async function request(path = "", body?: any) {
    if (!pair) throw Error("Scan the pairing QR on your desktop first.");
    const r = await fetch("/api/mobile-scan/" + pair.id + path, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        "x-scanner-token": pair.token,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12000),
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error);
    return data;
  }
  useEffect(() => {
    if (!pair) return;
    request()
      .then((d) => setTarget(d.target))
      .catch((e) => setMessage(e.message));
  }, [pair]);
  async function send(value: string, retry?: any) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setCamera(false);
    const event = retry || { id: crypto.randomUUID(), code: value.trim() };
    setPending(event);
    try {
      sessionStorage.setItem(
        "ayngaran-scanner-pending",
        JSON.stringify({ pairId: pair?.id, event }),
      );
      await request("", event);
      setMessage("Sent. Waiting for desktop confirmation…");
      setCode("");
    } catch (e: any) {
      setMessage(e.message + " Use Retry; do not rescan the same item.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!pending || !pair) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const data = await request("?event=" + pending.id);
        if (!stopped && data.event?.status === "received") {
          setMessage(data.event.message);
          sessionStorage.removeItem("ayngaran-scanner-pending");
          setPending(null);
          setCount((n) => n + 1);
        }
      } catch (e: any) {
        if (!stopped) setMessage(e.message);
      }
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [pending, pair]);
  return (
    <main className="mobile-scanner-page">
      <h1>Ayngaran Scanner</h1>
      <p>Phone camera → desktop {target || "POS"}</p>
      {!pair ? (
        <section>
          <p>
            On your desktop, open POS or Record purchase and choose Connect
            phone scanner. Scan its QR, or paste the complete pairing link
            below. Both devices can use the same Wi-Fi network.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const url = new URL(pairingLink);
                if (
                  url.protocol !== "https:" ||
                  !url.hash ||
                  url.pathname !== "/mobile-scanner"
                )
                  throw Error(
                    "Paste the complete HTTPS pairing link from your desktop.",
                  );
                location.assign(url.href);
              } catch (e: any) {
                setMessage(e.message);
              }
            }}
          >
            <label>
              Desktop pairing link
              <input
                type="url"
                required
                value={pairingLink}
                placeholder="https://192.168.1.20:3000/mobile-scanner#…"
                onChange={(e) => setPairingLink(e.target.value)}
              />
            </label>
            <button className="primary">Connect to desktop</button>
          </form>
          <p role="alert">{message}</p>
        </section>
      ) : (
        <>
          <p>{count} scans confirmed by desktop</p>
          <p role="status">{message}</p>
          {pending ? (
            <>
              <p>Pending: {pending.code}</p>
              <button
                className="primary"
                disabled={busy}
                onClick={() => send(pending.code, pending)}
              >
                Retry same scan
              </button>
              <p>
                Keep the desktop pairing panel open. Do not submit the item
                again while its result is uncertain.
              </p>
            </>
          ) : camera ? (
            <>
              <button className="button" onClick={() => setCamera(false)}>
                Close camera
              </button>
              <Scanner onScan={(value) => send(value)} />
            </>
          ) : (
            <>
              <button className="primary wide" onClick={() => setCamera(true)}>
                Scan next barcode / QR
              </button>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (code.trim()) send(code);
                }}
              >
                <label>
                  Product code
                  <input
                    value={code}
                    maxLength={500}
                    required
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
                <button className="button" disabled={busy}>
                  Send to desktop
                </button>
              </form>
            </>
          )}
          <button
            className="button"
            onClick={() => {
              sessionStorage.removeItem("ayngaran-scanner-pair");
              sessionStorage.removeItem("ayngaran-scanner-pending");
              setPair(null);
              setPending(null);
              setCamera(false);
            }}
          >
            Disconnect this phone
          </button>
        </>
      )}
      <p>
        Install: Android Chrome → Install app / Add to home screen. iPhone
        Safari → Share → Add to Home Screen. If pairing is lost after
        installation, open the pairing link again.
      </p>
      <p>
        Requires internet and a shared HTTPS site. Scan values identify
        products; no prices, payments or customer records are stored on this
        phone.
      </p>
    </main>
  );
}
