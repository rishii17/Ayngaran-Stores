import products from "../data/supplier-sample-products.json" with { type: "json" };
import { applyAction, money } from "./domain.mjs";
import { supplierSampleId } from "./runtime-config.mjs";
export { supplierSampleCount, supplierSampleId } from "./runtime-config.mjs";

// Browser sample workspace only. Quotes are not evidence of real purchases.
export function addSupplierSample(state, mode) {
  if (mode !== "demo")
    throw new Error("Supplier sample data is only available in sample mode.");
  if (state.sampleLists?.includes(supplierSampleId)) return { state, added: 0 };
  let next = structuredClone(state);
  const supplierId = `${supplierSampleId}-supplier`;
  if (next.suppliers.some((s) => s.id === supplierId))
    throw new Error("Sample supplier ID already exists.");
  const imported = products.map((entry, i) => ({
    id: entry.id,
    name: `${entry.name} · ${entry.originalName}${entry.price === null ? " [selling price missing]" : ""}`,
    tamil: "",
    category: entry.category,
    price: entry.price ?? 0,
    cost: entry.cost,
    stock: 0,
    unit: "listed unit",
    sku: `SAMPLE-LIST-${String(i + 1).padStart(3, "0")}`,
    barcode: "",
    reorder: 5,
    image: "",
    art: "sample",
    active: entry.price !== null,
    sampleQuote: entry.sourceQuote,
    sampleCaseQuantity: entry.caseQuantity,
    sampleNote: entry.note,
  }));
  if (
    imported.some((p) =>
      next.products.some((old) => old.id === p.id || old.sku === p.sku),
    )
  ) {
    throw new Error(
      "Sample product IDs or SKUs already exist; existing products were preserved.",
    );
  }
  next.products.push(...imported);
  next.suppliers.push({
    id: supplierId,
    name: "Sample supplier — uploaded price list",
    phone: "",
    address: "Test data only; supplier identity not provided",
    openingBalance: 0,
  });
  const items = imported
    .filter((p) => p.active)
    .map((p) => ({
      productId: p.id,
      quantity: 12,
      cost: p.cost,
      sellingPrice: p.price,
    }));
  next = applyAction(next, {
    type: "purchase",
    payload: {
      supplierId,
      items,
      paid: money(
        items.reduce((sum, p) => sum + money(p.quantity * p.cost), 0),
      ),
      reference:
        "SAMPLE ONLY: quoted costs, 12 test units each; not a real purchase",
    },
  }).state;
  next.sampleLists = [...(next.sampleLists || []), supplierSampleId];
  return { state: next, added: imported.length };
}
