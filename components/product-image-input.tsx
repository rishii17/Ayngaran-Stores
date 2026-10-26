"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { webp } from "@/lib/client";

export default function ProductImageInput({
  value,
  onChange,
  onError,
  onBusyChange,
}: {
  value: string;
  onChange: (image: string) => void;
  onError: (message: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const processing = useRef(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      onBusyChange(false);
    };
  }, [onBusyChange]);
  async function selectImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || processing.current) return;
    processing.current = true;
    setBusy(true);
    onBusyChange(true);
    onError("");
    try {
      const image = await webp(file);
      if (mounted.current) onChange(image);
    } catch (error: any) {
      if (mounted.current)
        onError(
          error.message ||
            "Unable to read this photo. Try a JPEG or PNG image.",
        );
    } finally {
      processing.current = false;
      if (mounted.current) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  }
  return (
    <div className="product-image-field">
      <span>Product image (optional)</span>
      <div className="upload-box">
        {value ? (
          <>
            <img src={value} alt="Product preview" />
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => onChange("")}
            >
              Remove image
            </button>
          </>
        ) : (
          <ImagePlus size={28} />
        )}
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => camera.current?.click()}
        >
          <Camera size={17} /> Take photo
        </button>
        <input
          ref={camera}
          hidden
          aria-label="Take product photo"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={busy}
          onChange={selectImage}
        />
        <label>
          Choose from photos
          <input
            aria-label="Product image"
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={selectImage}
          />
        </label>
        <span role="status">
          {busy
            ? "Optimizing photo…"
            : "Photos are resized and optimized to WebP before saving."}
        </span>
      </div>
    </div>
  );
}
