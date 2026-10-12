"use client";
import { useId, useRef, useState } from "react";
export default function HardwareScanner({
  onCode,
  disabled = false,
}: {
  onCode: (code: string) => string;
  disabled?: boolean;
}) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(""),
    [message, setMessage] = useState("");
  return (
    <div className="hardware-scanner">
      <label htmlFor={id}>Hardware scanner</label>
      <div className="hardware-scanner-row">
        <input
          id={id}
          ref={input}
          value={value}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          maxLength={500}
          placeholder="Click here, then scan a barcode"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.repeat || disabled) return;
            const code = e.currentTarget.value.trim();
            if (!code) return;
            setMessage(onCode(code));
            setValue("");
          }}
        />
        <button
          type="button"
          className="button"
          disabled={disabled}
          onClick={() => input.current?.focus()}
        >
          Ready to scan
        </button>
      </div>
      <small>Keyboard/HID mode · Enter suffix · One scan adds one unit</small>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
