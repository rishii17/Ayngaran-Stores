import { searchIndex, searchItems } from "./search.mjs";

// Keep each supplier's history separate; current catalogue costs are not purchases.
export function purchaseComparisons(
  products,
  suppliers,
  purchases,
  query = "",
) {
  const rows = [];
  for (const product of products) {
    const groups = new Map();
    for (const purchase of purchases) {
      for (const line of purchase.items || [purchase]) {
        if (line.productId !== product.id) continue;
        const supplierId = purchase.supplierId;
        if (!groups.has(supplierId)) groups.set(supplierId, []);
        groups.get(supplierId).push({
          cost: line.cost,
          unit: line.unit || product.unit,
          name: line.name || product.name,
          date: purchase.date,
          number: purchase.number,
        });
      }
    }
    if (!groups.size) groups.set(null, []);
    for (const [supplierId, history] of groups) {
      history.sort((a, b) => new Date(b.date) - new Date(a.date));
      const supplier = suppliers.find((s) => s.id === supplierId);
      const latest = history[0];
      const cost = latest ? latest.cost : product.cost;
      const comparable = !latest || latest.unit === product.unit;
      rows.push({
        product,
        supplierId,
        supplierName:
          supplier?.name ||
          (supplierId ? "Unknown supplier" : "No purchases yet"),
        history,
        cost,
        unit: latest?.unit || product.unit,
        margin:
          comparable && product.price > 0 && Number.isFinite(cost)
            ? ((product.price - cost) / product.price) * 100
            : null,
      });
    }
  }
  return searchItems(
    searchIndex(rows, (r) => [
      r.product.name,
      r.product.tamil,
      r.product.sku,
      r.product.barcode,
      r.supplierName,
      ...r.history.map((h) => h.name),
    ]),
    query,
  );
}
