"use client";
import { useMemo, useState } from "react";
import { purchaseComparisons } from "../lib/purchase-comparison.mjs";
type Comparison = {
  product: any;
  supplierId: string | null;
  supplierName: string;
  cost: number;
  unit: string;
  margin: number | null;
  history: { cost: number; unit: string; date: string; number: string }[];
};
const currency = (value: number) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat("en-LK", {
        style: "currency",
        currency: "LKR",
      }).format(value)
    : "—";
const date = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", { timeZone: "Asia/Colombo" });

export default function PurchaseComparison({
  products,
  suppliers,
  purchases,
}: {
  products: any[];
  suppliers: any[];
  purchases: any[];
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");
  const rows = useMemo(() => {
    const matches: Comparison[] = purchaseComparisons(
      products,
      suppliers,
      purchases,
      query,
    );
    return matches.sort((a, b) =>
      sort === "cost"
        ? (a.cost ?? Infinity) - (b.cost ?? Infinity)
        : sort === "margin"
          ? (b.margin ?? -Infinity) - (a.margin ?? -Infinity)
          : a.product.name.localeCompare(b.product.name),
    );
  }, [products, suppliers, purchases, query, sort]);
  return (
    <section className="panel" aria-label="Compare buying costs">
      <div className="panel-heading">
        <div>
          <h2>Compare buying costs</h2>
          <p>
            Find brands saved in product names and compare suppliers before
            restocking.
          </p>
        </div>
      </div>
      <div className="table-toolbar">
        <div className="search-box">
          <input
            aria-label="Search products or companies"
            placeholder="Search product, brand or supplier company…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label>
          Sort by{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Product name</option>
            <option value="cost">Lowest buying cost</option>
            <option value="margin">Highest margin</option>
          </select>
        </label>
        <span className="muted" role="status">
          {rows.length} results
        </span>
      </div>
      <p className="comparison-note muted">
        Costs are per listed unit. Compare matching pack sizes and units. Margin
        uses today’s selling price and excludes tax, discounts and other
        expenses; past costs are not supplier quotes.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Product / brand</th>
              <th>Supplier / company</th>
              <th>Buying cost / unit</th>
              <th>Current selling price</th>
              <th>Potential margin</th>
              <th>Previous purchases</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.product.id}:${row.supplierId || "none"}`}>
                <td>
                  <strong>{row.product.name}</strong>
                  {row.product.sampleQuote && (
                    <div className="muted">
                      Source quote: {row.product.sampleQuote}
                      {row.product.sampleNote
                        ? ` · ${row.product.sampleNote}`
                        : ""}
                    </div>
                  )}
                  <div className="muted">
                    {row.product.sku} · Stock {row.product.stock}{" "}
                    {row.product.unit}
                    {row.product.deletedAt
                      ? " · Deleted"
                      : row.product.active === false
                        ? " · Inactive"
                        : ""}
                  </div>
                </td>
                <td>{row.supplierName}</td>
                <td>
                  {currency(row.cost)} / {row.unit}
                  <div className="muted">
                    {row.history.length
                      ? `Last bought ${date(row.history[0].date)}`
                      : "Current catalogue cost · no purchase history"}
                  </div>
                </td>
                <td>
                  {currency(row.product.price)} / {row.product.unit}
                </td>
                <td>
                  {row.margin === null ? "—" : `${row.margin.toFixed(1)}%`}
                </td>
                <td>
                  {row.history.length ? (
                    <details>
                      <summary>
                        {row.history.length} purchase
                        {row.history.length === 1 ? "" : "s"}
                      </summary>
                      <ul>
                        {row.history.map((entry, index) => (
                          <li key={index}>
                            {date(entry.date)} · {entry.number} ·{" "}
                            {currency(entry.cost)} / {entry.unit}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    "No purchases recorded"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="comparison-note" role="status">
          No matching products or companies. Try a product name such as chilli,
          a brand, or a supplier name.
        </p>
      )}
    </section>
  );
}
