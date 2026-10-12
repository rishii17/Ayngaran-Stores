"use client";
import { useMemo, useState } from "react";
import { searchIndex, searchItems } from "../lib/search.mjs";
import { money } from "../lib/domain.mjs";
export default function PurchaseForm({
  products,
  suppliers,
  busy,
  onSave,
}: {
  products: any[];
  suppliers: any[];
  busy: boolean;
  onSave: (payload: any) => Promise<void>;
}) {
  const [supplierId, setSupplier] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [paid, setPaid] = useState("0");
  const [reference, setReference] = useState("");
  const index = useMemo(
    () =>
      searchIndex(
        products.filter((p) => p.active !== false),
        (p: any) => [p.name, p.tamil, p.sku, p.barcode],
      ),
    [products],
  );
  const results = searchItems(index, query).slice(0, 12);
  const total = money(
    items.reduce(
      (sum, i) => sum + money(Number(i.quantity) * Number(i.cost)),
      0,
    ),
  );
  function add(p: any) {
    setItems((old) =>
      old.some((i) => i.productId === p.id)
        ? old.map((i) =>
            i.productId === p.id
              ? { ...i, quantity: String(money(Number(i.quantity) + 1)) }
              : i,
          )
        : [
            ...old,
            {
              productId: p.id,
              name: p.name,
              unit: p.unit,
              quantity: "1",
              cost: String(p.cost),
              sellingPrice: String(p.price),
            },
          ],
    );
    setQuery("");
  }
  function update(id: string, key: string, value: string) {
    setItems((old) =>
      old.map((i) => (i.productId === id ? { ...i, [key]: value } : i)),
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!items.length) return;
        await onSave({
          supplierId,
          reference,
          paid: Number(paid),
          items: items.map((i) => ({
            productId: i.productId,
            quantity: Number(i.quantity),
            cost: Number(i.cost),
            sellingPrice: Number(i.sellingPrice),
          })),
        });
      }}
    >
      <fieldset disabled={busy} className="purchase-fields">
        <label className="field">
          Supplier *
          <select
            required
            value={supplierId}
            onChange={(e) => setSupplier(e.target.value)}
          >
            <option value="">Select supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Find products
          <input
            value={query}
            placeholder="Search name, Tamil, SKU or scan barcode"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (results[0]) add(results[0]);
              }
            }}
          />
        </label>
        <div className="purchase-results">
          {results.map((p: any) => (
            <button type="button" key={p.id} onClick={() => add(p)}>
              {p.name} <small>{p.sku} · Add +</small>
            </button>
          ))}
        </div>
        {!results.length && <p>No matching products.</p>}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Unit cost</th>
                <th>Selling price</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.productId}>
                  <td>
                    {i.name}
                    <small className="muted"> / {i.unit}</small>
                  </td>
                  {["quantity", "cost", "sellingPrice"].map((key) => (
                    <td key={key}>
                      <input
                        aria-label={`${i.name} ${key}`}
                        type="number"
                        min="0.01"
                        max="1000000000"
                        step="0.01"
                        required
                        value={i[key]}
                        onChange={(e) =>
                          update(i.productId, key, e.target.value)
                        }
                      />
                    </td>
                  ))}
                  <td>
                    {money(Number(i.quantity) * Number(i.cost)).toFixed(2)}
                  </td>
                  <td>
                    <button
                      type="button"
                      aria-label={`Remove ${i.name}`}
                      onClick={() =>
                        setItems((old) =>
                          old.filter((x) => x.productId !== i.productId),
                        )
                      }
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>{items.length} products · Quantities use each product’s unit.</p>
        <div className="payment-balance">
          <span>Purchase total</span>
          <strong>Rs. {total.toFixed(2)}</strong>
        </div>
        <label className="field">
          Paid now (LKR)
          <input
            type="number"
            min="0"
            max={total}
            step="0.01"
            required
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
          />
        </label>
        <label className="field">
          Supplier invoice / reference
          <input
            maxLength={500}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
        <p className="muted">
          Supplier balance increases by Rs.{" "}
          {money(total - Number(paid)).toFixed(2)}. Saving updates stock,
          purchase costs and selling prices.
        </p>
        <button className="primary wide" disabled={busy || !items.length}>
          Save purchase & receive stock
        </button>
      </fieldset>
    </form>
  );
}
