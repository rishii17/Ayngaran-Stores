"use client";
import { useMemo, useState } from "react";
import { matchesBill } from "@/lib/search.mjs";
export default function CustomerBills({
  sales,
  customer,
  onReceipt,
}: {
  sales: any[];
  customer: any;
  onReceipt: (sale: any) => void;
}) {
  const [query, setQuery] = useState("");
  const bills = useMemo(
    () =>
      sales.filter(
        (s) =>
          s.customerId === customer.id && matchesBill(s, query, [customer]),
      ),
    [sales, customer, query],
  );
  return (
    <section className="customer-bills">
      <h3>Customer bills</h3>
      <input
        aria-label="Search this customer's bills"
        placeholder="Search bill number or sale ID"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Bill</th>
              <th>Date</th>
              <th>Total LKR</th>
              <th>Credit on bill</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.number}
                  <small>{s.void ? "Voided" : s.method}</small>
                </td>
                <td>
                  {new Date(s.date).toLocaleDateString("en-GB", {
                    timeZone: "Asia/Colombo",
                  })}
                </td>
                <td>{s.total.toFixed(2)}</td>
                <td>{s.void ? "—" : (s.total - s.paid).toFixed(2)}</td>
                <td>
                  <button className="text-button" onClick={() => onReceipt(s)}>
                    View / print
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!bills.length && (
        <p className="muted">No matching bills for this customer.</p>
      )}
      <p className="muted">
        Credit on bill is the original unpaid amount. Later collections appear
        in the account ledger below.
      </p>
    </section>
  );
}
