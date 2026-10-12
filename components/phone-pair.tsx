"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/client";
export default function PhonePair({
  target,
  onCode,
  enabled = true,
}: {
  target: "bill" | "purchase";
  onCode: (code: string) => string;
  enabled?: boolean;
}) {
  const [address, setAddress] = useState("");
  useEffect(() => {
    setAddress(
      localStorage.getItem("ayngaran-scanner-address") || location.origin,
    );
  }, []);
  const [pair, setPair] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const svg = useRef<HTMLDivElement>(null),
    callback = useRef(onCode),
    active = useRef(enabled),
    seen = useRef(new Map<string, string>());
  callback.current = onCode;
  active.current = enabled;
  useEffect(() => {
    if (!pair) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const data = await api("scanner-pairs/" + pair.id);
        for (const event of data.events.slice(0, 1)) {
          if (stopped || !active.current) break;
          let message = seen.current.get(event.id);
          if (!message) {
            message = callback.current(event.code);
            seen.current.set(event.id, message);
          }
          await api("scanner-pairs/" + pair.id + "/ack", {
            method: "POST",
            body: JSON.stringify({ id: event.id, message }),
          });
        }
        if (!stopped) setError("");
      } catch (e: any) {
        if (!stopped) setError(e.message);
      }
      if (!stopped) timer = setTimeout(poll, 1200);
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      void api("scanner-pairs/" + pair.id, { method: "DELETE" }).catch(
        () => {},
      );
    };
  }, [pair]);
  useEffect(() => {
    if (!pair || !svg.current) return;
    let stopped = false;
    import("@zxing/library")
      .then(({ QRCodeWriter, BarcodeFormat }) => {
        if (stopped || !svg.current) return;
        const matrix = new QRCodeWriter().encode(
          pair.link,
          BarcodeFormat.QR_CODE,
          240,
          240,
          new Map(),
        );
        const ns = "http://www.w3.org/2000/svg";
        const image = document.createElementNS(ns, "svg");
        image.setAttribute("viewBox", "0 0 240 240");
        image.setAttribute("width", "240");
        image.setAttribute("height", "240");
        image.setAttribute("aria-label", "Phone pairing QR code");
        const background = document.createElementNS(ns, "rect");
        background.setAttribute("width", "240");
        background.setAttribute("height", "240");
        background.setAttribute("fill", "white");
        image.append(background);
        const path = document.createElementNS(ns, "path");
        let d = "";
        for (let y = 0; y < 240; y++)
          for (let x = 0; x < 240; x++)
            if (matrix.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
        path.setAttribute("d", d);
        path.setAttribute("fill", "black");
        image.append(path);
        svg.current.replaceChildren(image);
      })
      .catch(() => setError("QR could not load. Use the pairing link."));
    return () => {
      stopped = true;
    };
  }, [pair]);
  async function connect() {
    setBusy(true);
    setError("");
    try {
      const shared = new URL(address.trim());
      if (
        shared.protocol !== "https:" ||
        shared.username ||
        shared.password ||
        ["localhost", "127.0.0.1", "[::1]"].includes(shared.hostname)
      )
        throw Error(
          "Enter your computer’s reachable HTTPS Wi-Fi address, such as https://192.168.1.20:3000. Phone cameras require a trusted certificate; localhost points to the phone itself.",
        );
      localStorage.setItem("ayngaran-scanner-address", shared.origin);
      const p = await api("scanner-pairs", {
        method: "POST",
        body: JSON.stringify({ target }),
      });
      seen.current.clear();
      setPair({
        ...p,
        link: shared.origin + "/mobile-scanner#" + p.id + ":" + p.token,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="phone-pair">
      {!pair && (
        <label>
          Computer / website HTTPS address
          <input
            aria-label="Computer HTTPS address"
            type="url"
            placeholder="https://192.168.1.20:3000"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <small>
            Same Wi-Fi: enter your computer’s IPv4 address and HTTPS port. Keep
            the server running.
          </small>
        </label>
      )}
      <button
        type="button"
        className="button"
        disabled={busy || !enabled}
        onClick={() => (pair ? setPair(null) : connect())}
      >
        {pair ? "Disconnect phone scanner" : "Connect phone scanner"}
      </button>
      {error && <p role="alert">{error}</p>}
      {pair && (
        <div>
          <strong>Scan to pair with this {target}</strong>
          <div ref={svg} />
          <a href={pair.link} target="_blank" rel="noreferrer">
            Open mobile scanner
          </a>
          <button
            type="button"
            className="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(pair.link);
              } catch {
                setError(
                  "Copy the Open mobile scanner link using your browser’s copy-link option.",
                );
              }
            }}
          >
            Copy pairing link
          </button>
          <p>
            Keep this panel open. Pairing expires in one hour. Anyone with this
            link can submit scans, so share it only with your scanner device.
          </p>
          <p>
            {enabled
              ? "Receiving scans"
              : "Paused while another dialog is open"}
          </p>
        </div>
      )}
    </section>
  );
}
