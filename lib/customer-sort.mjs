import { customerBalance } from "./domain.mjs";
const collator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});
export function sortCustomers(customers, state, order = "name-asc") {
  const rows = customers.map((customer) => ({
    customer,
    balance: order.startsWith("balance-")
      ? customerBalance(state, customer.id)
      : 0,
  }));
  return rows
    .sort((a, b) => {
      let result = 0;
      if (order === "balance-desc") result = b.balance - a.balance;
      else if (order === "balance-asc") result = a.balance - b.balance;
      else if (order === "credit-desc")
        result = (b.customer.creditLimit || 0) - (a.customer.creditLimit || 0);
      else if (order === "village") {
        const av = a.customer.village?.trim() || "",
          bv = b.customer.village?.trim() || "";
        result = av && bv ? collator.compare(av, bv) : av ? -1 : bv ? 1 : 0;
      }
      const name = collator.compare(a.customer.name, b.customer.name);
      return (
        result ||
        (order === "name-desc" ? -name : name) ||
        collator.compare(a.customer.id, b.customer.id)
      );
    })
    .map((row) => row.customer);
}
