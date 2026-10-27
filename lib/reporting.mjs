import { money } from "./domain.mjs";
import { cashDay } from "./cash-ledger.mjs";
export const localDay = cashDay;
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
    cashCreditIssued: money(
      (state.customerCredits || [])
        .filter((credit) => localDay(credit.date) === date)
        .reduce((total, credit) => total + credit.amount, 0),
    ),
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
