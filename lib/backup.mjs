import ExcelJS from "exceljs";
import { customerBalance, supplierBalance, money } from "./domain.mjs";
import { dailySummary, localDay, grossProfit } from "./reporting.mjs";
import { contactCode } from "./search.mjs";
export function validDate(date) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date + "T12:00:00Z")) ||
    new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date
  )
    throw Error("Choose a valid backup date");
  return date;
}
export async function createBackup(state, date, mode = "live") {
  validDate(date);
  const book = new ExcelJS.Workbook();
  book.creator = "Ayngaran Stores";
  book.created = new Date();
  function sheet(name, headers, rows) {
    const s = book.addWorksheet(name);
    s.addRow(headers);
    for (const row of rows)
      s.addRow(
        row.map((v) =>
          v == null ? "" : typeof v === "number" ? v : String(v),
        ),
      );
    s.views = [{ state: "frozen", ySplit: 1 }];
    s.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF783B42" },
    };
    s.columns.forEach((c, i) => (c.width = i === 0 ? 25 : 22));
    s.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, s.rowCount), column: headers.length },
    };
    return s;
  }
  const summary = dailySummary(state, date);
  sheet(
    "Read me",
    ["Setting", "Value"],
    [
      ["Store", state.settings.name],
      ["Currency", "LKR"],
      ["Report date", date],
      ["Timezone", "Asia/Colombo"],
      ["Exported at", new Date().toISOString()],
      ["Workspace", mode],
      [
        "Scope",
        "Daily summary plus complete current data snapshot; current balances are not historical closing balances.",
      ],
      [
        "Profit",
        "Gross profit after discount, before overheads and tax. Credit sales count as earned profit.",
      ],
      [
        "Restore",
        "Restore JSON contains the full snapshot in ordered chunks. Keep the JSON export as the easier machine backup.",
      ],
    ],
  );
  sheet("Daily summary", ["Metric", "Value"], Object.entries(summary));
  const saleHeaders = [
    "Bill",
    "Sale ID",
    "Date UTC",
    "Customer",
    "Customer ID",
    "Customer code",
    "Village",
    "Method",
    "Subtotal",
    "Discount",
    "Tax",
    "Total LKR",
    "Paid",
    "Credit on bill",
    "Gross profit",
    "Status",
  ];
  const saleRow = (s) => [
    s.number,
    s.id,
    s.date,
    s.customerName,
    s.customerId,
    s.customerCode,
    s.customerVillage,
    s.method,
    s.subtotal,
    s.discount,
    s.tax,
    s.total,
    s.paid,
    money(s.total - s.paid),
    grossProfit(s),
    s.void ? "VOID" : "Completed",
  ];
  sheet(
    "Daily sales",
    saleHeaders,
    state.sales.filter((s) => localDay(s.date) === date).map(saleRow),
  );
  sheet("All sales", saleHeaders, state.sales.map(saleRow));
  sheet(
    "All sale items",
    [
      "Bill",
      "Sale ID",
      "Product",
      "Product ID",
      "SKU",
      "Quantity",
      "Unit",
      "Selling price at sale",
      "Cost at sale",
      "Line total",
      "Line cost",
      "Voided",
    ],
    state.sales.flatMap((s) =>
      s.items.map((l) => [
        s.number,
        s.id,
        l.name,
        l.productId,
        l.sku,
        l.quantity,
        l.unit,
        l.price,
        l.cost,
        money(l.price * l.quantity),
        money(l.cost * l.quantity),
        s.void ? "Yes" : "No",
      ]),
    ),
  );
  sheet(
    "All payments",
    ["Payment ID", "Date UTC", "Customer ID", "Supplier ID", "Amount", "Note"],
    state.payments.map((p) => [
      p.id,
      p.date,
      p.customerId,
      p.supplierId,
      p.amount,
      p.note,
    ]),
  );
  sheet(
    "All purchases",
    [
      "Purchase",
      "ID",
      "Date UTC",
      "Supplier ID",
      "Product ID",
      "Quantity",
      "Unit cost",
      "Total",
      "Paid",
      "Reference",
    ],
    state.purchases.map((p) => [
      p.number,
      p.id,
      p.date,
      p.supplierId,
      p.productId,
      p.quantity,
      p.cost,
      p.total,
      p.paid,
      p.reference,
    ]),
  );
  sheet(
    "Stock movements",
    ["ID", "Date UTC", "Product ID", "Quantity", "Type", "Reference"],
    state.movements.map((m) => [
      m.id,
      m.date,
      m.productId,
      m.quantity,
      m.type,
      m.reference,
    ]),
  );
  sheet(
    "Current products",
    [
      "ID",
      "Name",
      "Tamil name",
      "SKU",
      "Barcode",
      "Category",
      "Unit",
      "Selling price",
      "Cost",
      "Stock",
      "Reorder",
      "Image stored",
    ],
    state.products.map((p) => [
      p.id,
      p.name,
      p.tamil,
      p.sku,
      p.barcode,
      p.category,
      p.unit,
      p.price,
      p.cost,
      p.stock,
      p.reorder,
      p.image ? "Yes" : "No",
    ]),
  );
  sheet(
    "Current customers",
    [
      "ID",
      "Code",
      "Name",
      "Phone",
      "Village",
      "Address",
      "Opening balance",
      "Credit limit",
      "Current outstanding",
    ],
    state.customers.map((c) => [
      c.id,
      contactCode(c),
      c.name,
      c.phone,
      c.village,
      c.address,
      c.openingBalance,
      c.creditLimit,
      customerBalance(state, c.id),
    ]),
  );
  sheet(
    "Current suppliers",
    [
      "ID",
      "Code",
      "Name",
      "Phone",
      "Address",
      "Opening balance",
      "Current outstanding",
    ],
    state.suppliers.map((c) => [
      c.id,
      c.code,
      c.name,
      c.phone,
      c.address,
      c.openingBalance,
      supplierBalance(state, c.id),
    ]),
  );
  sheet(
    "Price history",
    [
      "ID",
      "Date UTC",
      "Product ID",
      "Old selling price",
      "New selling price",
      "Old cost",
      "New cost",
      "Reason",
    ],
    (state.priceHistory || []).map((p) => [
      p.id,
      p.date,
      p.productId,
      p.oldPrice,
      p.newPrice,
      p.oldCost,
      p.newCost,
      p.reason,
    ]),
  );
  sheet(
    "Villages",
    ["Village"],
    (state.villages || []).map((v) => [v]),
  );
  const json = JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    mode,
    state,
  });
  const chunks = [];
  for (const part of json.match(/[\s\S]{1,16000}/gu) || [])
    chunks.push([chunks.length + 1, part]);
  sheet("Restore JSON", ["Chunk order", "JSON text (join in order)"], chunks);
  return book.xlsx.writeBuffer();
}
