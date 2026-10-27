"use client";
import { useEffect, useState } from "react";
import { cashDay, openDrawer, drawerSummary } from "../lib/cash-ledger.mjs";
const fmt = (value: number) => Number(value).toFixed(2);
export default function CashDrawer({
  state,
  busy,
  onAction,
}: {
  state: any;
  busy: boolean;
  onAction: (type: string, payload: any) => Promise<any>;
}) {
  const [today, setToday] = useState("");
  const [opening, setOpening] = useState("");
  const [counted, setCounted] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState("in");
  const [note, setNote] = useState("");
  useEffect(() => {
    const tick = () => setToday(cashDay(new Date()));
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, []);
  const session = openDrawer(state);
  const summary = session ? drawerSummary(state, session) : null;
  const current = session?.day === today;
  return (
    <section className="panel cash-drawer">
      <div className="panel-heading">
        <div>
          <h2>Cash drawer</h2>
          <p>
            Opening cash is optional. Only cash recorded while today’s drawer is
            open is tracked.
          </p>
        </div>
        <span className="pill">
          {session ? "Open · " + session.day : "Closed"}
        </span>
      </div>
      {!session ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              await onAction("openDrawer", {
                amount: Number(opening),
                note: "Opening cash",
              })
            )
              setOpening("");
          }}
        >
          <label>
            Opening cash (LKR)
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={opening}
              onChange={(event) => setOpening(event.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>
            Start drawer
          </button>
          <p className="muted">
            Enter the cash physically in the drawer now, including any earlier
            cash activity. Each store has its own drawer.
          </p>
        </form>
      ) : (
        <>
          {!current && (
            <p className="alert">
              This drawer belongs to a previous day. Close it before starting
              today’s drawer. New-day transactions are not added to the previous
              drawer.
            </p>
          )}
          <div className="table-scroll">
            <table>
              <tbody>
                {[
                  ["Opening cash", summary!.opening],
                  ["Cash sales received", summary!.cashSales],
                  ["Customer collections", summary!.collections],
                  ["Cash added", summary!.added],
                  ["Purchases paid in cash", -summary!.purchases],
                  ["Supplier cash payments", -summary!.supplierPayments],
                  ["Cash lent to customers", -summary!.customerCredits],
                  ["Cash withdrawn", -summary!.withdrawn],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>Rs. {fmt(Number(value))}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>Expected drawer cash</strong>
                  </td>
                  <td>
                    <strong>Rs. {fmt(summary!.expected)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {summary!.expected < 0 && (
            <p className="alert">
              Expected cash is negative. Review withdrawals and record any
              missing cash additions.
            </p>
          )}
          {current && (
            <form
              className="drawer-form"
              onSubmit={async (event) => {
                event.preventDefault();
                if (
                  await onAction("drawerMovement", {
                    amount: Number(amount),
                    direction,
                    note,
                  })
                ) {
                  setAmount("");
                  setNote("");
                }
              }}
            >
              <h3>Add or withdraw cash</h3>
              <label>
                Cash direction
                <select
                  aria-label="Cash direction"
                  value={direction}
                  onChange={(event) => setDirection(event.target.value)}
                >
                  <option value="in">Cash in</option>
                  <option value="out">Cash out</option>
                </select>
              </label>
              <label>
                Cash movement amount (LKR)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
              <label>
                Cash movement reason
                <input
                  required
                  maxLength={500}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              <button className="button" disabled={busy}>
                Save cash movement
              </button>
            </form>
          )}
          <form
            className="drawer-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                await onAction("closeDrawer", {
                  sessionId: session.id,
                  amount: Number(counted),
                  note: closingNote,
                })
              ) {
                setCounted("");
                setClosingNote("");
              }
            }}
          >
            <h3>End-of-day cash count</h3>
            <label>
              Counted cash (LKR)
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={counted}
                onChange={(event) => setCounted(event.target.value)}
              />
            </label>
            {counted !== "" && (
              <p role="status">
                Cash difference: Rs. {fmt(Number(counted) - summary!.expected)}
              </p>
            )}
            <label>
              Closing note / difference reason
              <input
                maxLength={500}
                required={
                  counted !== "" && Number(counted) !== summary!.expected
                }
                value={closingNote}
                onChange={(event) => setClosingNote(event.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              Close drawer
            </button>
          </form>
        </>
      )}
      <p className="muted">
        Card/bank payments and cash supplied outside the drawer are excluded.
        Voiding a sale does not return money automatically: record any cash
        refund as Cash out with a reason. Cash activity after closing is not
        tracked until another drawer is started.
      </p>
      <h3>Drawer history</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>Opening</th>
              <th>Expected</th>
              <th>Counted</th>
              <th>Difference</th>
              <th>Closing note</th>
            </tr>
          </thead>
          <tbody>
            {(state.cashSessions || [])
              .filter((item: any) => item.closedAt)
              .map((item: any) => (
                <tr key={item.id}>
                  <td>{item.day}</td>
                  <td>{fmt(item.openingAmount)}</td>
                  <td>{fmt(item.closingSummary.expected)}</td>
                  <td>{fmt(item.countedCash)}</td>
                  <td>{fmt(item.difference)}</td>
                  <td>{item.closingNote || "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {session && (
        <>
          <h3>Current drawer movements</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type / reference</th>
                  <th>Cash in</th>
                  <th>Cash out</th>
                </tr>
              </thead>
              <tbody>
                {(state.cashMovements || [])
                  .filter((item: any) => item.sessionId === session.id)
                  .map((item: any) => (
                    <tr key={item.id}>
                      <td>
                        {new Date(item.date).toLocaleTimeString("en-GB", {
                          timeZone: "Asia/Colombo",
                        })}
                      </td>
                      <td>
                        {item.type}
                        <small>{item.note || item.reference}</small>
                      </td>
                      <td>
                        {item.direction === "in" ? fmt(item.amount) : "—"}
                      </td>
                      <td>
                        {item.direction === "out" ? fmt(item.amount) : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
