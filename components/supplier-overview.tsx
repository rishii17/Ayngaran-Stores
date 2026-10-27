"use client";
import { useEffect, useMemo, useState } from "react";
import { supplierPriorities } from "../lib/supplier-priority.mjs";
import { cashDay } from "../lib/cash-ledger.mjs";
import {
  searchIndex,
  searchItems,
  contactFields,
  contactCode,
} from "../lib/search.mjs";
const fmt = (n: number) =>
  new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
const date = (value: string) =>
  value ? (value.length > 10 ? cashDay(value) : value) : "—";
type SupplierRow = {
  supplier: any;
  balance: number;
  rank: number;
  priority: string;
  nextDate: string;
  nextLabel: string;
  lastPayment: string;
};
export default function SupplierOverview({
  state,
  onForm,
}: {
  state: any;
  onForm: (name: string, value?: any) => void;
}) {
  const [today, setToday] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("priority");
  useEffect(() => {
    const tick = () => setToday(cashDay(new Date()));
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, []);
  const rows: SupplierRow[] = useMemo(
    () => supplierPriorities(state.suppliers, state, today, sort),
    [state, today, sort],
  );
  const matches = useMemo(
    () =>
      new Set(
        searchItems(searchIndex(state.suppliers, contactFields), query).map(
          (item: any) => item.id,
        ),
      ),
    [state.suppliers, query],
  );
  const payable = rows.reduce(
    (total, row) => total + Math.max(0, row.balance),
    0,
  );
  const overdue = rows.filter(
    (row) =>
      row.balance > 0 &&
      [row.supplier.paymentDueDate, row.supplier.nextChequeDate].some(
        (day) => day && day < today,
      ),
  );
  return (
    <>
      <div className="supplier-actions">
        <button className="primary" onClick={() => onForm("purchase")}>
          Record purchase
        </button>
        <button className="button" onClick={() => onForm("comparison")}>
          Compare buying costs
        </button>
      </div>
      <section className="panel" aria-label="Supplier payment priorities">
        <div className="supplier-summary">
          <div>
            <small>Total payable</small>
            <strong>Rs. {fmt(payable)}</strong>
          </div>
          <div>
            <small>Overdue payment reminders</small>
            <strong>{overdue.length} suppliers</strong>
          </div>
          <div>
            <small>Cheque reminders due</small>
            <strong>
              {
                rows.filter(
                  (row) =>
                    row.balance > 0 &&
                    row.supplier.nextChequeDate &&
                    row.supplier.nextChequeDate <= today,
                ).length
              }
            </strong>
          </div>
        </div>
        <div className="table-toolbar">
          <div className="search-box">
            <input
              aria-label="Search suppliers"
              placeholder="Search suppliers by name, phone, ID or village"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <label className="customer-sort">
            Sort suppliers
            <select
              aria-label="Sort suppliers"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="priority">Payment priority</option>
              <option value="balance">Highest payable</option>
              <option value="cheque">Nearest cheque date</option>
              <option value="visit">Next visit</option>
              <option value="lastPayment">Oldest last payment</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>
        <p className="comparison-note muted">
          Priority: overdue reminders, today, upcoming dates, then unscheduled
          outstanding balances. Cheques are reminders only; record a bank
          payment when cleared and clear the reminder.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Outstanding payable</th>
                <th>Priority / due</th>
                <th>Next cheque reminder</th>
                <th>Supplier visits</th>
                <th>Last payment recorded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((row) => matches.has(row.supplier.id))
                .map((row) => {
                  const c = row.supplier;
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        <small>
                          {contactCode(c)} · {c.phone || "No phone"}
                        </small>
                        <small>{c.address || "No address"}</small>
                      </td>
                      <td>
                        <strong
                          className={row.balance > 0 ? "negative" : "positive"}
                        >
                          Rs. {fmt(row.balance)}
                        </strong>
                      </td>
                      <td>
                        <span
                          className={
                            "status " + (row.rank < 2 ? "amber" : "green")
                          }
                        >
                          {row.priority}
                        </span>
                        <small>{date(row.nextDate)}</small>
                        <small>Payment due: {date(c.paymentDueDate)}</small>
                      </td>
                      <td>
                        {date(c.nextChequeDate)}
                        {c.chequeAmount > 0 && (
                          <small>Rs. {fmt(c.chequeAmount)}</small>
                        )}
                        {c.chequeReference && (
                          <small>{c.chequeReference}</small>
                        )}
                      </td>
                      <td>
                        Last: {date(c.lastVisitDate)}
                        <small>Next: {date(c.nextVisitDate)}</small>
                      </td>
                      <td>{date(row.lastPayment)}</td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() =>
                            onForm("supplierSchedule", {
                              supplierId: c.id,
                              paymentDueDate: c.paymentDueDate || "",
                              nextChequeDate: c.nextChequeDate || "",
                              chequeAmount: c.chequeAmount || 0,
                              chequeReference: c.chequeReference || "",
                              lastVisitDate: c.lastVisitDate || "",
                              nextVisitDate: c.nextVisitDate || "",
                            })
                          }
                        >
                          Plan dates
                        </button>
                        <button
                          className="text-button"
                          disabled={row.balance <= 0}
                          onClick={() =>
                            onForm("payment", {
                              supplierId: c.id,
                              amount: 0,
                              note: "",
                            })
                          }
                        >
                          Pay supplier
                        </button>
                        <button
                          className="text-button"
                          onClick={() =>
                            onForm("ledger", { ...c, kind: "supplier" })
                          }
                        >
                          View account
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!rows.some((row) => matches.has(row.supplier.id)) && (
          <p className="comparison-note muted">No matching suppliers.</p>
        )}
      </section>
    </>
  );
}
