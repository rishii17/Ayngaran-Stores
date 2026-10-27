import { supplierBalance } from "./domain.mjs";
import { validCalendarDate } from "./calendar-date.mjs";
export function supplierPriorities(
  suppliers,
  state,
  today,
  order = "priority",
) {
  const rows = suppliers.map((supplier) => {
    const balance = supplierBalance(state, supplier.id);
    const paymentDates = [
      ...state.payments
        .filter((p) => p.supplierId === supplier.id && p.amount > 0)
        .map((p) => p.date),
      ...state.purchases
        .filter((p) => p.supplierId === supplier.id && p.paid > 0)
        .map((p) => p.date),
    ]
      .filter((value) => Number.isFinite(new Date(value).getTime()))
      .sort((a, b) => new Date(b) - new Date(a));
    const events = [
      ...(balance > 0
        ? [
            { date: supplier.paymentDueDate, label: "Payment" },
            { date: supplier.nextChequeDate, label: "Cheque" },
          ]
        : []),
      { date: supplier.nextVisitDate, label: "Visit" },
    ]
      .filter((item) => validCalendarDate(item.date))
      .sort((a, b) => a.date.localeCompare(b.date));
    const next = events[0];
    const rank = next
      ? next.date < today
        ? 0
        : next.date === today
          ? 1
          : 2
      : balance > 0
        ? 3
        : 4;
    return {
      supplier,
      balance,
      nextDate: next?.date || "",
      nextLabel: next?.label || "",
      rank,
      priority: next
        ? `${rank === 0 ? "Overdue" : rank === 1 ? "Today" : "Upcoming"} · ${next.label.toLowerCase()}`
        : balance > 0
          ? "Outstanding · no date"
          : "Settled",
      lastPayment: paymentDates[0] || "",
    };
  });
  const dateOrder = (a, b) =>
    (a || "9999-12-31").localeCompare(b || "9999-12-31");
  return rows.sort((a, b) => {
    let comparison = 0;
    if (order === "balance") comparison = b.balance - a.balance;
    else if (order === "cheque")
      comparison = dateOrder(
        a.supplier.nextChequeDate,
        b.supplier.nextChequeDate,
      );
    else if (order === "visit")
      comparison = dateOrder(
        a.supplier.nextVisitDate,
        b.supplier.nextVisitDate,
      );
    else if (order === "lastPayment")
      comparison = (a.lastPayment || "").localeCompare(b.lastPayment || "");
    else if (order === "priority")
      comparison =
        a.rank - b.rank ||
        dateOrder(a.nextDate, b.nextDate) ||
        b.balance - a.balance;
    return (
      comparison ||
      a.supplier.name.localeCompare(b.supplier.name) ||
      a.supplier.id.localeCompare(b.supplier.id)
    );
  });
}
