"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, ScanLine, Flashlight, Sun } from "lucide-react";
export default function Scanner({
  onScan,
}: {
  onScan: (value: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    trackRef = useRef<MediaStreamTrack | null>(null),
    callback = useRef(onScan),
    lowRef = useRef(false);
  callback.current = onScan;
  const [error, setError] = useState(""),
    [code, setCode] = useState(""),
    [torch, setTorch] = useState(false),
    [torchAvailable, setTorchAvailable] = useState(false),
    [lowLight, setLowLight] = useState(false),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [camera, setCamera] = useState(""),
    [zoom, setZoom] = useState(1),
    [zoomRange, setZoomRange] = useState<any>(null),
    [status, setStatus] = useState("Starting camera…");
  lowRef.current = lowLight;
  useEffect(() => {
    let cancelled = false,
      stream: MediaStream | null = null,
      timer: ReturnType<typeof setTimeout> | undefined;
    const element = video.current;
    setError("");
    setStatus("Starting camera…");
    setTorch(false);
    setTorchAvailable(false);
    setZoomRange(null);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw Error(
            "Camera requires HTTPS or localhost. Enter the barcode below instead.",
          );
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...(camera
              ? { deviceId: { exact: camera } }
              : { facingMode: { ideal: "environment" } }),
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const caps = track.getCapabilities?.() as any;
        setTorchAvailable(Boolean(caps?.torch));
        if (caps?.zoom) {
          setZoomRange(caps.zoom);
          setZoom((track.getSettings() as any).zoom || caps.zoom.min);
        }
        const advanced: any = {};
        if (caps?.focusMode?.includes("continuous"))
          advanced.focusMode = "continuous";
        if (caps?.exposureMode?.includes("continuous"))
          advanced.exposureMode = "continuous";
        if (Object.keys(advanced).length)
          await track
            .applyConstraints({ advanced: [advanced] })
            .catch(() => {});
        if (cancelled) return;
        setDevices(
          (await navigator.mediaDevices.enumerateDevices()).filter(
            (d) => d.kind === "videoinput",
          ),
        );
        if (cancelled) return;
        element!.srcObject = stream;
        await element!.play();
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        let detector: any = null;
        const Native = (window as any).BarcodeDetector;
        if (Native)
          try {
            const formats = await Native.getSupportedFormats();
            detector = new Native({ formats });
          } catch {}
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        let frame = 0;
        if (cancelled) return;
        setStatus(
          detector ? "Fast camera scanning ready" : "Camera scanning ready",
        );
        const decode = async () => {
          if (cancelled) return;
          try {
            if (element!.readyState >= 2 && element!.videoWidth) {
              const scale = Math.min(1, 1280 / element!.videoWidth);
              canvas.width = Math.round(element!.videoWidth * scale);
              canvas.height = Math.round(element!.videoHeight * scale);
              context.filter = lowRef.current
                ? "brightness(1.5) contrast(1.25) grayscale(1)"
                : "none";
              context.drawImage(element!, 0, 0, canvas.width, canvas.height);
              let value = "";
              if (detector)
                try {
                  value = (await detector.detect(canvas))[0]?.rawValue || "";
                } catch {
                  detector = null;
                }
              if (!value && (!detector || frame++ % 3 === 0))
                try {
                  value = reader.decodeFromCanvas(canvas).getText();
                } catch {}
              if (value && !cancelled) {
                cancelled = true;
                stream?.getTracks().forEach((t) => t.stop());
                callback.current(value);
                return;
              }
            }
          } catch {}
          if (!cancelled) timer = setTimeout(decode, 100);
        };
        void decode();
      } catch (e: any) {
        if (!cancelled) {
          setStatus("Camera unavailable");
          setError(
            e.name === "NotAllowedError"
              ? "Camera permission was denied. Allow it in your browser or enter the barcode below."
              : e.message || "Unable to start camera",
          );
          stream?.getTracks().forEach((t) => t.stop());
        }
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
      if (element) element.srcObject = null;
    };
  }, [camera]);
  async function toggleTorch() {
    try {
      await trackRef.current?.applyConstraints({
        advanced: [{ torch: !torch } as any],
      });
      setTorch(!torch);
    } catch {
      setError(
        "This camera could not switch its torch. Try low-light enhancement or move to brighter light.",
      );
    }
  }
  return (
    <div>
      <div className="camera-frame">
        <video ref={video} muted playsInline />
        <ScanLine size={64} />
      </div>
      <p className="muted" role="status">
        {status}. Hold the barcode or QR code steady and fill the guide.
      </p>
      <div className="scanner-controls">
        <button
          type="button"
          className="button"
          disabled={!torchAvailable}
          aria-pressed={torch}
          onClick={toggleTorch}
        >
          <Flashlight size={16} />
          {torch ? "Torch off" : "Torch on"}
        </button>
        <button
          type="button"
          className={"button " + (lowLight ? "selected" : "")}
          aria-pressed={lowLight}
          onClick={() => setLowLight(!lowLight)}
        >
          <Sun size={16} />
          Low-light enhancement
        </button>
      </div>
      {!torchAvailable && (
        <p className="muted">
          Torch is not available on this camera/browser. Enhancement can help,
          but a visible, sharp barcode is still needed.
        </p>
      )}
      {devices.length > 1 && (
        <label>
          Camera
          <select value={camera} onChange={(e) => setCamera(e.target.value)}>
            <option value="">Automatic rear camera</option>
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
      )}
      {zoomRange && (
        <label>
          Zoom
          <input
            type="range"
            min={zoomRange.min}
            max={zoomRange.max}
            step={zoomRange.step || 0.1}
            value={zoom}
            onChange={async (e) => {
              const value = Number(e.target.value);
              try {
                await trackRef.current?.applyConstraints({
                  advanced: [{ zoom: value } as any],
                });
                setZoom(value);
              } catch {
                setError("Zoom could not be changed.");
              }
            }}
          />
        </label>
      )}
      {error && <div className="alert">{error}</div>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) onScan(code.trim());
        }}
      >
        <label>
          Or enter a barcode / QR value
          <input
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
