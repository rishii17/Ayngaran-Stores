"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import {
  searchIndex,
  searchItems,
  contactFields,
  contactCode,
} from "@/lib/search.mjs";
export default function CustomerPicker({
  customers,
  value,
  onChange,
}: {
  customers: any[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [highlight, setHighlight] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const index = useMemo(
    () => searchIndex(customers, contactFields),
    [customers],
  );
  const matches = useMemo(
    () => searchItems(index, query).slice(0, 12),
    [index, query],
  );
  const selected = customers.find((c) => c.id === value);
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);
  function choose(id: string) {
    onChange(id);
    setQuery("");
    setOpen(false);
    setHighlight(0);
  }
  return (
    <div className="customer-picker" ref={root}>
      <div className="picker-input">
        <Search size={16} />
        <input
          role="combobox"
          aria-label="Search POS customers"
          aria-expanded={open}
          aria-controls="pos-customer-results"
          aria-autocomplete="list"
          aria-activedescendant={
            open && matches[highlight]
              ? `customer-option-${highlight}`
              : undefined
          }
          placeholder="Name, phone, ID or village"
          value={
            open
              ? query
              : selected
                ? `${selected.name} · ${selected.village || contactCode(selected)}`
                : ""
          }
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((i) =>
                Math.min(matches.length - 1, Math.max(0, i + 1)),
              );
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter" && open) {
              e.preventDefault();
              if (matches[highlight]) choose(matches[highlight].id);
            }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        {value && (
          <button
            type="button"
            title="Use walk-in customer"
            onClick={() => choose("")}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && (
        <div
          className="customer-results"
          id="pos-customer-results"
          role="listbox"
          aria-label="Customer matches"
        >
          <button
            role="option"
            aria-selected={!value}
            onClick={() => choose("")}
          >
            Walk-in customer
          </button>
          {matches.map((c: any, i: number) => (
            <button
              id={`customer-option-${i}`}
              role="option"
              aria-selected={value === c.id}
              className={highlight === i ? "highlighted" : ""}
              key={c.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(c.id)}
            >
              <strong>{c.name}</strong>
              <small>
                {c.village || "No village"} · {c.phone || "No phone"} ·{" "}
                {contactCode(c)}
              </small>
            </button>
          ))}
          {!matches.length && <p>No matching customer. Use + to add one.</p>}
          <small className="picker-hint">
            Showing up to 12 matches. Type more to narrow results.
          </small>
        </div>
      )}
    </div>
  );
}
