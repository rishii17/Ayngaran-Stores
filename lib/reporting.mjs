import { money } from "./domain.mjs";
export function localDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw Error("Invalid date");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function grossProfit(sale) {
  return sale.void
    ? 0
    : money(
        sale.subtotal -
          sale.discount -
          sale.items.reduce((a, l) => a + money(l.cost * l.quantity), 0),
      );
}
export function dailySummary(state, date) {
  const sales = state.sales.filter((s) => localDay(s.date) === date && !s.void);
  const payments = state.payments.filter((p) => localDay(p.date) === date);
  return {
    bills: sales.length,
    sales: money(sales.reduce((a, s) => a + s.total, 0)),
    profit: money(sales.reduce((a, s) => a + grossProfit(s), 0)),
    creditIssued: money(sales.reduce((a, s) => a + s.total - s.paid, 0)),
    collectedOnBills: money(sales.reduce((a, s) => a + s.paid, 0)),
    creditCollected: money(
      payments.filter((p) => p.customerId).reduce((a, p) => a + p.amount, 0),
    ),
    supplierPaid: money(
      payments.filter((p) => p.supplierId).reduce((a, p) => a + p.amount, 0),
    ),
  };
}
