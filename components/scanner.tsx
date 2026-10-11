"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, ScanLine } from "lucide-react";
export default function Scanner({
  onScan,
}: {
  onScan: (value: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const callback = useRef(onScan);
  callback.current = onScan;
  useEffect(() => {
    let stopped = false;
    let controls: any;
    let reader: any;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw Error(
            "Camera requires HTTPS or localhost. You can enter the barcode below.",
          );
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (stopped) return;
        reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
            },
            audio: false,
          },
          video.current!,
          (result: any) => {
            if (result && !stopped) {
              stopped = true;
              controls?.stop();
              callback.current(result.getText());
            }
          },
        );
        if (stopped) controls.stop();
      } catch (e: any) {
        if (!stopped)
          setError(
            e.name === "NotAllowedError"
              ? "Camera access was denied. Allow camera access in your browser, or enter the barcode."
              : e.message || "Unable to start camera",
          );
      }
    })();
    return () => {
      stopped = true;
      controls?.stop();
      const stream = video.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  return (
    <div>
      <div className="camera-frame">
        <video ref={video} muted playsInline />
        <ScanLine size={64} />
      </div>
      <p className="muted">
        Point your camera at a product barcode. Scanning stops after a match.
      </p>
      {error && <div className="alert">{error}</div>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) onScan(code.trim());
        }}
      >
        <label>
          Or enter a barcode
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="4790001000001"
            required
          />
        </label>
        <button className="primary wide">
          <Camera size={17} />
          Find product
        </button>
      </form>
    </div>
  );
}
