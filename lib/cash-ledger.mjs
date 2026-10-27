const round = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export function cashDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw Error("Invalid date");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function openDrawer(state) {
  return (
    (state.cashSessions || []).find((session) => !session.closedAt) || null
  );
}
export function drawerSummary(state, session) {
  if (session.closingSummary) return session.closingSummary;
  const movements = (state.cashMovements || []).filter(
    (m) => m.sessionId === session.id,
  );
  const sum = (filter) =>
    round(movements.filter(filter).reduce((total, m) => total + m.amount, 0));
  const cashIn = sum((m) => m.direction === "in");
  const cashOut = sum((m) => m.direction === "out");
  return {
    opening: session.openingAmount,
    cashIn,
    cashOut,
    cashSales: sum((m) => m.type === "sale"),
    collections: sum((m) => m.type === "collection"),
    purchases: sum((m) => m.type === "purchase"),
    supplierPayments: sum((m) => m.type === "supplierPayment"),
    customerCredits: sum((m) => m.type === "customerCredit"),
    added: sum((m) => m.type === "cashIn"),
    withdrawn: sum((m) => m.type === "cashOut"),
    expected: round(session.openingAmount + cashIn - cashOut),
  };
}
export function recordDrawerCash(
  state,
  { amount, direction, type, reference, note = "" },
  now,
) {
  const session = openDrawer(state);
  // Tracking is optional; opening cash already includes activity before opening.
  if (!session || session.day !== cashDay(now) || amount <= 0) return null;
  const movement = {
    id: crypto.randomUUID(),
    sessionId: session.id,
    date: now,
    amount: round(amount),
    direction,
    type,
    reference,
    note,
  };
  (state.cashMovements ||= []).unshift(movement);
  return movement;
}
