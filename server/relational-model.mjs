// Single mapping contract for normalized SQL and the existing screen/API state.
// Monetary and measured values use exact decimal columns in PostgreSQL.
const text = "text",
  money = "numeric(20,2)",
  date = "timestamptz";
const fields = (defs) =>
  Object.fromEntries(defs.map(([key, type = text]) => [key, type]));
export const models = {
  settings: {
    single: true,
    fields: fields([
      ["name"],
      ["address"],
      ["phone"],
      ["currency"],
      ["receiptNote"],
      ["taxRate", money],
    ]),
  },
  villages: { fields: fields([["name"]]), key: "name" },
  products: {
    fields: fields([
      ["id"],
      ["name"],
      ["tamil"],
      ["category"],
      ["sku"],
      ["barcode"],
      ["price", money],
      ["cost", money],
      ["unit"],
      ["reorder", money],
      ["art"],
      ["active", "boolean"],
    ]),
  },
  product_images: { fields: fields([["id"], ["image"]]) },
  inventory: { fields: fields([["id"], ["stock", money]]) },
  customers: {
    fields: fields([
      ["id"],
      ["name"],
      ["phone"],
      ["address"],
      ["village"],
      ["code"],
      ["openingBalance", money],
      ["creditLimit", money],
    ]),
  },
  suppliers: {
    fields: fields([
      ["id"],
      ["name"],
      ["phone"],
      ["address"],
      ["village"],
      ["code"],
      ["openingBalance", money],
    ]),
  },
  sales: {
    prepend: true,
    children: "sale_items",
    fields: fields([
      ["id"],
      ["number"],
      ["date", date],
      ["customerId"],
      ["customerName"],
      ["customerCode"],
      ["customerVillage"],
      ["seller", "jsonb"],
      ["subtotal", money],
      ["discount", money],
      ["tax", money],
      ["total", money],
      ["paid", money],
      ["method"],
      ["tendered", money],
      ["change", money],
      ["void", "boolean"],
      ["voidReason"],
      ["voidDate", date],
    ]),
  },
  sale_items: {
    line: true,
    parent: "sales",
    fields: fields([
      ["productId"],
      ["name"],
      ["tamil"],
      ["sku"],
      ["unit"],
      ["quantity", money],
      ["price", money],
      ["cost", money],
    ]),
  },
  purchases: {
    prepend: true,
    children: "purchase_items",
    fields: fields([
      ["id"],
      ["supplierId"],
      ["reference"],
      ["paid", money],
      ["date", date],
      ["total", money],
      ["number"],
    ]),
  },
  purchase_items: {
    line: true,
    parent: "purchases",
    fields: fields([
      ["productId"],
      ["name"],
      ["sku"],
      ["unit"],
      ["quantity", money],
      ["cost", money],
      ["sellingPrice", money],
      ["total", money],
    ]),
  },
  payments: {
    prepend: true,
    fields: fields([
      ["id"],
      ["customerId"],
      ["supplierId"],
      ["amount", money],
      ["note"],
      ["date", date],
    ]),
  },
  stock_movements: {
    state: "movements",
    prepend: true,
    fields: fields([
      ["id"],
      ["productId"],
      ["quantity", money],
      ["type"],
      ["reference"],
      ["date", date],
    ]),
  },
  held_bills: {
    state: "held",
    children: "held_bill_items",
    fields: fields([
      ["id"],
      ["customerId"],
      ["discount", money],
      ["label"],
      ["date", date],
    ]),
  },
  held_bill_items: {
    line: true,
    parent: "held_bills",
    fields: fields([["productId"], ["quantity", money]]),
  },
  price_history: {
    state: "priceHistory",
    prepend: true,
    fields: fields([
      ["id"],
      ["productId"],
      ["date", date],
      ["oldPrice", money],
      ["newPrice", money],
      ["oldCost", money],
      ["newCost", money],
      ["reason"],
    ]),
  },
};
export const column = (key) =>
  key.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
function row(model, value, position) {
  const extras = { ...value };
  const result = { position, extras };
  for (const key of Object.keys(model.fields)) {
    result[column(key)] = value[key] ?? null;
    // Explicit nulls remain in extras, preserving historical JSON semantics.
    if (value[key] != null) delete extras[key];
  }
  return result;
}
export function relationalRows(state) {
  const rows = Object.fromEntries(Object.keys(models).map((k) => [k, []]));
  rows.settings.push(row(models.settings, state.settings, 0));
  rows.villages = (state.villages || []).map((name, i) =>
    row(models.villages, { name }, i),
  );
  for (const [name, model] of Object.entries(models)) {
    if (
      model.single ||
      model.line ||
      ["villages", "product_images", "inventory"].includes(name)
    )
      continue;
    const values = state[model.state || name] || [];
    rows[name] = values.map((original, i) => {
      const value = { ...original };
      if (name === "products") {
        rows.product_images.push(
          row(
            models.product_images,
            { id: value.id, image: value.image || "" },
            i,
          ),
        );
        rows.inventory.push(
          row(models.inventory, { id: value.id, stock: value.stock }, i),
        );
        delete value.image;
        delete value.stock;
      }
      if (model.children) {
        // Pre-multi-line purchases are normalized without changing old totals.
        const oldProduct = state.products.find((p) => p.id === value.productId);
        const items =
          value.items ||
          (name === "purchases"
            ? [
                {
                  productId: value.productId,
                  quantity: value.quantity,
                  cost: value.cost,
                  total: value.total,
                  name: oldProduct?.name,
                  sku: oldProduct?.sku,
                  unit: oldProduct?.unit,
                },
              ]
            : []);
        for (const [lineNo, item] of items.entries())
          rows[model.children].push({
            ...row(models[model.children], item, lineNo),
            parent_id: value.id,
            line_no: lineNo,
          });
        delete value.items;
      }
      return row(model, value, model.prepend ? i - values.length : i);
    });
  }
  return rows;
}
function identity(name, row) {
  const m = models[name];
  return m.single
    ? "settings"
    : m.line
      ? `${row.parent_id}:${row.line_no}`
      : row[m.key || "id"];
}
export function relationalChanges(before, after) {
  const previous = relationalRows(before),
    next = relationalRows(after);
  const known = new Set([
    "settings",
    "villages",
    "products",
    "customers",
    "suppliers",
    "sales",
    "purchases",
    "payments",
    "movements",
    "held",
    "priceHistory",
  ]);
  const changes = {
    _state_extras: Object.fromEntries(
      Object.entries(after).filter(([key]) => !known.has(key)),
    ),
  };
  for (const name of Object.keys(models)) {
    const old = new Map(previous[name].map((r) => [identity(name, r), r]));
    changes[name] = next[name].filter(
      (r) => JSON.stringify(old.get(identity(name, r))) !== JSON.stringify(r),
    );
  }
  // Only held drafts can be deleted in the existing workflow. Financial records
  // are retained and voided, preserving receipts and movement history.
  const held = new Set(after.held.map((r) => r.id));
  changes.deleted_held = before.held
    .filter((r) => !held.has(r.id))
    .map((r) => r.id);
  return changes;
}
