import {
  cashDay,
  openDrawer,
  drawerSummary,
  recordDrawerCash,
} from "./cash-ledger.mjs";
import { VILLAGES, contactCode } from "./search.mjs";
export const money = (n) =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export function ean13(prefix) {
  if (!/^\d{12}$/.test(prefix))
    throw Error("EAN-13 prefix must contain 12 digits");
  const sum = [...prefix].reduce(
    (total, n, i) => total + Number(n) * (i % 2 ? 3 : 1),
    0,
  );
  return prefix + String((10 - (sum % 10)) % 10);
}
export const uid = () => crypto.randomUUID();
export function emptyState() {
  return {
    products: [],
    customers: [],
    suppliers: [],
    sales: [],
    payments: [],
    purchases: [],
    movements: [],
    held: [],
    villages: [...VILLAGES],
    priceHistory: [],
    cashSessions: [],
    cashMovements: [],
    customerCredits: [],
    settings: {
      name: "Ayngaran Stores",
      address: "Jaffna, Sri Lanka",
      phone: "",
      currency: "LKR",
      receiptNote: "Thank you. Visit us again!",
      taxRate: 0,
    },
  };
}
export function seedState() {
  const s = emptyState();
  const rows = [
    ["Samba Rice", "அரிசி", "Rice & grains", 240, 205, 125, "kg", "rice"],
    [
      "Red Raw Rice",
      "சிவப்பு அரிசி",
      "Rice & grains",
      220,
      185,
      85,
      "kg",
      "rice",
    ],
    ["Toor Dhal", "பருப்பு", "Pulses & spices", 420, 360, 42, "kg", "dhal"],
    ["White Sugar", "சீனி", "Essentials", 290, 255, 65, "kg", "sugar"],
    [
      "Coconut Oil",
      "தேங்காய் எண்ணெய்",
      "Oils & cooking",
      680,
      590,
      24,
      "bottle",
      "oil",
    ],
    ["Fresh Milk", "பால்", "Dairy & eggs", 480, 425, 18, "carton", "milk"],
    ["Ceylon Tea", "தேயிலை", "Beverages", 560, 470, 32, "pack", "tea"],
    [
      "Wheat Flour",
      "கோதுமை மாவு",
      "Rice & grains",
      210,
      175,
      56,
      "kg",
      "flour",
    ],
    [
      "Chilli Powder",
      "மிளகாய்த்தூள்",
      "Pulses & spices",
      380,
      320,
      8,
      "pack",
      "spice",
    ],
    ["Cream Crackers", "பிஸ்கட்", "Snacks", 240, 195, 36, "pack", "biscuit"],
    ["Fresh Eggs", "முட்டை", "Dairy & eggs", 45, 36, 120, "each", "eggs"],
    [
      "Turmeric Powder",
      "மஞ்சள்",
      "Pulses & spices",
      260,
      210,
      6,
      "pack",
      "spice",
    ],
    ["Basmati Rice", "பாஸ்மதி", "Rice & grains", 720, 630, 28, "kg", "rice"],
    [
      "Sunflower Oil",
      "சூரியகாந்தி எண்ணெய்",
      "Oils & cooking",
      990,
      875,
      15,
      "bottle",
      "oil",
    ],
    [
      "Green Gram",
      "பச்சைப்பயறு",
      "Pulses & spices",
      620,
      535,
      22,
      "kg",
      "dhal",
    ],
    ["Mineral Water", "குடிநீர்", "Beverages", 120, 85, 48, "bottle", "water"],
  ];
  s.products = rows.map((p, i) => ({
    id: uid(),
    name: p[0],
    tamil: p[1],
    category: p[2],
    price: p[3],
    cost: p[4],
    stock: p[5],
    unit: p[6],
    art: p[7],
    sku: `AYS-${String(i + 1).padStart(3, "0")}`,
    barcode: ean13(`479000100${String(i + 1).padStart(3, "0")}`),
    reorder: 10,
    image: "",
    active: true,
  }));
  s.customers = [
    {
      id: uid(),
      name: "K. Sivakumar",
      phone: "077 123 4567",
      address: "Nallur, Jaffna",
      openingBalance: 2400,
      creditLimit: 15000,
    },
    {
      id: uid(),
      name: "S. Priyanka",
      phone: "076 234 5678",
      address: "Kokuvil, Jaffna",
      openingBalance: 0,
      creditLimit: 10000,
    },
    {
      id: uid(),
      name: "M. Thiruchelvam",
      phone: "075 345 6789",
      address: "Chunnakam",
      openingBalance: 1250,
      creditLimit: 10000,
    },
  ];
  s.suppliers = [
    {
      id: uid(),
      name: "Northern Wholesale Traders",
      phone: "021 222 3456",
      address: "Stanley Road, Jaffna",
      openingBalance: 0,
    },
    {
      id: uid(),
      name: "Lanka Food Distributors",
      phone: "077 456 7890",
      address: "Colombo",
      openingBalance: 0,
    },
  ];
  return s;
}
function requireThat(test, message) {
  if (!test) throw new Error(message);
}
function positive(n, label, zero = false) {
  requireThat(
    Number.isFinite(n) && (zero ? n >= 0 : n > 0),
    `${label} must be ${zero ? "zero or " : ""}positive`,
  );
  requireThat(
    n <= 1e9 && Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
    `${label} must have at most two decimal places and be at most 1,000,000,000`,
  );
  return n;
}
export function customerBalance(s, id) {
  const c = s.customers.find((c) => c.id === id);
  return money(
    (c?.openingBalance || 0) +
      s.sales
        .filter((x) => x.customerId === id && !x.void)
        .reduce((a, x) => a + x.total - x.paid, 0) +
      (s.customerCredits || [])
        .filter((x) => x.customerId === id)
        .reduce((total, credit) => total + credit.amount, 0) -
      s.payments
        .filter((x) => x.customerId === id)
        .reduce((a, x) => a + x.amount, 0),
  );
}
export function supplierBalance(s, id) {
  return money(
    (s.suppliers.find((x) => x.id === id)?.openingBalance || 0) +
      s.purchases
        .filter((x) => x.supplierId === id)
        .reduce((a, x) => a + x.total - x.paid, 0) -
      s.payments
        .filter((x) => x.supplierId === id)
        .reduce((a, x) => a + x.amount, 0),
  );
}
export function discountSettings(value, fallback = {}, price = value.price) {
  const discountType = value.discountType ?? fallback.discountType ?? "amount";
  const discountValue = value.discountValue ?? fallback.discountValue ?? 0;
  requireThat(
    ["amount", "percent"].includes(discountType),
    "Choose amount or percentage discount",
  );
  positive(discountValue, "Product discount", true);
  requireThat(
    discountValue <= (discountType === "percent" ? 100 : price),
    discountType === "percent"
      ? "Product discount cannot exceed 100%"
      : "Product discount exceeds selling price",
  );
  return { discountType, discountValue };
}
export function linePricing(line) {
  const discountType = line.discountType ?? "amount";
  const discountValue = line.discountValue ?? 0;
  const unitDiscount = money(
    Math.min(
      line.price,
      Math.max(
        0,
        discountType === "percent"
          ? (line.price * discountValue) / 100
          : discountValue,
      ),
    ),
  );
  const lineSubtotal = money(line.price * line.quantity);
  const discountAmount = Math.min(
    lineSubtotal,
    money(unitDiscount * line.quantity),
  );
  return {
    unitDiscount,
    netPrice: money(line.price - unitDiscount),
    lineSubtotal,
    discountAmount,
    lineTotal: money(lineSubtotal - discountAmount),
  };
}
export function totals(lines, discount = 0, taxRate = 0) {
  const prices = lines.map(linePricing);
  const subtotal = money(prices.reduce((a, l) => a + l.lineSubtotal, 0));
  const productDiscount = money(
    prices.reduce((a, l) => a + l.discountAmount, 0),
  );
  const billDiscount = money(
    Math.min(subtotal - productDiscount, Math.max(0, discount)),
  );
  const deduction = money(productDiscount + billDiscount);
  const tax = money(((subtotal - deduction) * taxRate) / 100);
  return {
    subtotal,
    productDiscount,
    billDiscount,
    discount: deduction,
    tax,
    total: money(subtotal - deduction + tax),
  };
}
export function applyAction(input, action) {
  const s = structuredClone(input),
    p = action.payload || {},
    now = new Date().toISOString();
  let result = null;
  const movement = (productId, quantity, type, reference) =>
    s.movements.unshift({
      id: uid(),
      productId,
      quantity,
      type,
      reference,
      date: now,
    });
  s.villages = [...new Set([...VILLAGES, ...(s.villages || [])])];
  s.priceHistory ||= [];
  const priceChange = (old, next, reason) => {
    if (old.price !== next.price || old.cost !== next.cost)
      s.priceHistory.unshift({
        id: uid(),
        productId: old.id,
        date: now,
        oldPrice: old.price,
        newPrice: next.price,
        oldCost: old.cost,
        newCost: next.cost,
        reason,
      });
  };
  switch (action.type) {
    case "seed": {
      requireThat(p.confirm === "LOAD DUMMY DATA", "Confirm sample import");
      requireThat(
        [
          "products",
          "customers",
          "suppliers",
          "sales",
          "payments",
          "purchases",
          "movements",
          "held",
          "cashSessions",
          "cashMovements",
          "customerCredits",
        ].every((key) => (s[key] || []).length === 0),
        "Dummy data can only be loaded into an empty store",
      );
      const seeded = action.seedTemplate
        ? structuredClone(action.seedTemplate)
        : seedWithTransactions();
      seeded.settings = s.settings;
      seeded.seededAt = now;
      return { state: seeded, result: { seeded: true } };
    }
    case "price": {
      const old = s.products.find((x) => x.id === p.productId);
      requireThat(old && !old.deletedAt, "Product is unavailable");
      positive(p.price, "Price");
      positive(p.cost, "Cost", true);
      requireThat(p.reason?.trim(), "Price change reason required");
      discountSettings(old, {}, p.price);
      priceChange(old, p, p.reason.trim());
      old.price = p.price;
      old.cost = p.cost;
      result = old;
      break;
    }
    case "deleteProduct": {
      requireThat(
        p.confirm === "DELETE",
        "Type DELETE to confirm product deletion",
      );
      const product = s.products.find((item) => item.id === p.productId);
      requireThat(product, "Product not found");
      if (!product.deletedAt) {
        requireThat(
          product.stock === 0,
          "Close this product’s inventory by bringing stock to zero before deleting it",
        );
        requireThat(
          !s.held.some((bill) =>
            bill.items?.some((line) => line.productId === product.id),
          ),
          "Remove this product from held bills before deleting it",
        );
        product.active = false;
        product.deletedAt = now;
      }
      result = { id: product.id, deleted: true };
      break;
    }
    case "product": {
      requireThat(p.name?.trim(), "Product name is required");
      positive(p.price, "Price");
      positive(p.cost, "Cost", true);
      positive(p.stock, "Stock", true);
      positive(p.reorder, "Reorder level", true);
      requireThat(
        !s.products.some(
          (x) =>
            x.id !== p.id &&
            ((p.barcode && x.barcode === p.barcode) ||
              (p.sku && x.sku === p.sku)),
        ),
        "Barcode or SKU already exists",
      );
      const old = s.products.find((x) => x.id === p.id);
      requireThat(
        !old?.deletedAt,
        "This product has been deleted and cannot be edited",
      );
      const item = {
        ...p,
        ...discountSettings(p, old, p.price),
        id: old?.id || uid(),
        name: p.name.trim(),
        active: true,
      };
      if (old) {
        priceChange(old, item, "Product edited");
        item.stock = old.stock;
        s.products[s.products.indexOf(old)] = item;
      } else {
        s.products.push(item);
        if (item.stock)
          movement(item.id, item.stock, "Opening stock", item.sku);
      }
      result = item;
      break;
    }
    case "customer":
    case "supplier": {
      const key = action.type === "customer" ? "customers" : "suppliers";
      requireThat(p.name?.trim(), "Name is required");
      positive(p.openingBalance || 0, "Opening balance", true);
      if (key === "customers") positive(p.creditLimit, "Credit limit", true);
      const old = s[key].find((x) => x.id === p.id);
      const item = {
        ...p,
        id: old?.id || uid(),
        name: p.name.trim(),
        openingBalance: old?.openingBalance ?? p.openingBalance ?? 0,
        village: (p.village || "").trim(),
        code:
          old?.code ||
          (old
            ? `${key === "customers" ? "CUS" : "SUP"}-${old.id.slice(0, 8).toUpperCase()}`
            : `${key === "customers" ? "CUS" : "SUP"}-${String(s[key].length + 1).padStart(5, "0")}`),
      };
      if (item.village && !s.villages.includes(item.village))
        s.villages.push(item.village);
      if (old) s[key][s[key].indexOf(old)] = item;
      else s[key].push(item);
      result = item;
      break;
    }
    case "openDrawer": {
      requireThat(
        !openDrawer(s),
        "Close the existing drawer before starting another day",
      );
      positive(p.amount, "Opening cash", true);
      const session = {
        id: uid(),
        day: cashDay(now),
        openedAt: now,
        openingAmount: p.amount,
        note: p.note?.trim() || "",
      };
      (s.cashSessions ||= []).unshift(session);
      result = session;
      break;
    }
    case "drawerMovement": {
      const session = openDrawer(s);
      requireThat(
        session && session.day === cashDay(now),
        "Open today’s drawer before adding or withdrawing cash",
      );
      positive(p.amount, "Cash amount");
      requireThat(
        ["in", "out"].includes(p.direction),
        "Choose cash in or cash out",
      );
      requireThat(p.note?.trim(), "Cash movement reason is required");
      result = recordDrawerCash(
        s,
        {
          amount: p.amount,
          direction: p.direction,
          type: p.direction === "in" ? "cashIn" : "cashOut",
          reference: session.id,
          note: p.note.trim(),
        },
        now,
      );
      break;
    }
    case "closeDrawer": {
      const session = openDrawer(s);
      requireThat(
        session && session.id === p.sessionId,
        "This drawer is already closed or unavailable",
      );
      positive(p.amount, "Counted cash", true);
      const summary = drawerSummary(s, session);
      requireThat(
        p.amount === summary.expected || p.note?.trim(),
        "Explain the difference between counted and expected cash",
      );
      Object.assign(session, {
        closedAt: now,
        countedCash: p.amount,
        difference: money(p.amount - summary.expected),
        closingNote: p.note?.trim() || "",
        closingSummary: summary,
      });
      result = session;
      break;
    }
    case "customerCredit": {
      const customer = s.customers.find((item) => item.id === p.customerId);
      requireThat(customer, "Select a customer");
      positive(p.amount, "Cash credit");
      requireThat(p.note?.trim(), "Cash credit reason is required");
      requireThat(
        ["drawer", "external"].includes(p.source),
        "Choose where the money comes from",
      );
      requireThat(
        customerBalance(s, customer.id) + p.amount <= customer.creditLimit,
        "Customer credit limit exceeded; update the limit in customer details first",
      );
      const credit = {
        id: uid(),
        customerId: customer.id,
        amount: p.amount,
        date: now,
        note: p.note.trim(),
        source: p.source,
      };
      (s.customerCredits ||= []).unshift(credit);
      if (p.source === "drawer")
        recordDrawerCash(
          s,
          {
            amount: credit.amount,
            direction: "out",
            type: "customerCredit",
            reference: credit.id,
            note: credit.note,
          },
          now,
        );
      result = credit;
      break;
    }
    case "checkout": {
      requireThat(
        Array.isArray(p.items) && p.items.length > 0,
        "Add products to the bill",
      );
      requireThat(
        ["cash", "card", "credit"].includes(p.method),
        "Choose a payment method",
      );
      const grouped = new Map();
      for (const line of p.items) {
        positive(line.quantity, "Quantity");
        const product = s.products.find(
          (x) => x.id === line.productId && x.active,
        );
        requireThat(product, "Product is unavailable");
        const setting = discountSettings(line, product, product.price);
        const previous = grouped.get(line.productId);
        requireThat(
          !previous ||
            (previous.discountType === setting.discountType &&
              previous.discountValue === setting.discountValue),
          "Duplicate product lines must use the same discount",
        );
        grouped.set(line.productId, {
          product,
          ...setting,
          quantity: money((previous?.quantity || 0) + line.quantity),
        });
      }
      const items = [...grouped].map(
        ([id, { product: item, quantity, ...setting }]) => {
          requireThat(
            item.stock >= quantity,
            `Only ${item.stock} ${item.unit} of ${item.name} in stock`,
          );
          const line = {
            productId: id,
            name: item.name,
            tamil: item.tamil || "",
            sku: item.sku,
            unit: item.unit,
            quantity,
            price: item.price,
            cost: item.cost,
            ...setting,
          };
          return { ...line, ...linePricing(line) };
        },
      );
      positive(p.discount || 0, "Discount", true);
      const bill = totals(items, p.discount || 0, s.settings.taxRate);
      requireThat(
        (p.discount || 0) <= money(bill.subtotal - bill.productDiscount),
        "Discount exceeds subtotal",
      );
      const c = s.customers.find((x) => x.id === p.customerId);
      requireThat(!p.customerId || c, "Customer not found");
      positive(p.tendered, "Payment", true);
      const paid =
        p.method === "card"
          ? bill.total
          : money(Math.min(p.tendered, bill.total));
      requireThat(p.method !== "credit" || c, "Select a customer for credit");
      requireThat(
        p.method !== "credit" || p.tendered <= bill.total,
        "Credit payment exceeds total",
      );
      requireThat(
        paid >= bill.total || c,
        "Select a customer to save the unpaid balance as credit",
      );
      if (c && paid < bill.total)
        requireThat(
          customerBalance(s, c.id) + bill.total - paid <= c.creditLimit,
          "Customer credit limit exceeded",
        );
      const sale = {
        id: uid(),
        number: `AYS-${String(s.sales.length + 1).padStart(5, "0")}`,
        date: now,
        customerId: c?.id || null,
        customerName: c?.name || "Walk-in customer",
        customerCode: c ? contactCode(c) : "",
        customerVillage: c?.village || "",
        seller: structuredClone(s.settings),
        items,
        ...bill,
        paid,
        method: p.method,
        tendered: p.tendered,
        change:
          p.method === "cash" ? money(Math.max(0, p.tendered - bill.total)) : 0,
        void: false,
      };
      for (const l of items) {
        const item = s.products.find((x) => x.id === l.productId);
        item.stock = money(item.stock - l.quantity);
        movement(item.id, -l.quantity, "Sale", sale.number);
      }
      s.sales.unshift(sale);
      if (sale.method !== "card")
        recordDrawerCash(
          s,
          {
            amount: sale.paid,
            direction: "in",
            type: "sale",
            reference: sale.id,
            note: sale.number,
          },
          now,
        );
      if (p.heldId) s.held = s.held.filter((x) => x.id !== p.heldId);
      result = sale;
      break;
    }
    case "payment": {
      positive(p.amount, "Payment");
      const customer = s.customers.find((x) => x.id === p.customerId),
        supplier = s.suppliers.find((x) => x.id === p.supplierId);
      requireThat(
        Boolean(customer) !== Boolean(supplier),
        "Select a customer or supplier",
      );
      const balance = customer
        ? customerBalance(s, customer.id)
        : supplierBalance(s, supplier.id);
      requireThat(p.amount <= balance, "Payment exceeds outstanding balance");
      requireThat(
        ["cash", "bank"].includes(p.paymentMethod || "cash"),
        "Choose cash or bank payment",
      );
      const payment = {
        ...p,
        paymentMethod: p.paymentMethod || "cash",
        id: uid(),
        date: now,
        amount: money(p.amount),
      };
      s.payments.unshift(payment);
      if (payment.paymentMethod === "cash")
        recordDrawerCash(
          s,
          {
            amount: payment.amount,
            direction: customer ? "in" : "out",
            type: customer ? "collection" : "supplierPayment",
            reference: payment.id,
            note: payment.note,
          },
          now,
        );
      result = payment;
      break;
    }
    case "purchase": {
      requireThat(
        s.suppliers.some((x) => x.id === p.supplierId),
        "Select a supplier",
      );
      const lines = p.items ?? [p];
      requireThat(
        Array.isArray(lines) && lines.length > 0 && lines.length <= 500,
        "Add 1–500 purchase products",
      );
      const seen = new Set();
      const items = lines.map((line) => {
        const product = s.products.find((x) => x.id === line.productId);
        requireThat(
          product && product.active !== false,
          "Select an active product",
        );
        requireThat(
          !seen.has(product.id),
          "Combine duplicate products into one line",
        );
        seen.add(product.id);
        positive(line.quantity, "Quantity");
        positive(line.cost, "Cost");
        const sellingPrice = line.sellingPrice ?? product.price;
        positive(sellingPrice, "Selling price");
        positive(money(product.stock + line.quantity), "Resulting stock", true);
        return {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit,
          quantity: line.quantity,
          cost: line.cost,
          sellingPrice,
          total: money(line.quantity * line.cost),
        };
      });
      positive(p.paid, "Paid amount", true);
      const total = money(items.reduce((sum, item) => sum + item.total, 0));
      positive(total, "Purchase total");
      requireThat(p.paid <= total, "Paid amount exceeds purchase total");
      requireThat(
        ["cash", "bank"].includes(p.paymentMethod || "cash"),
        "Choose cash or bank payment",
      );
      const purchase = {
        paymentMethod: p.paymentMethod || "cash",
        supplierId: p.supplierId,
        reference: p.reference || "",
        paid: p.paid,
        items,
        id: uid(),
        date: now,
        total,
        number: `PO-${String(s.purchases.length + 1).padStart(5, "0")}`,
      };
      for (const line of items) {
        const product = s.products.find((x) => x.id === line.productId);
        product.stock = money(product.stock + line.quantity);
        priceChange(
          product,
          { price: line.sellingPrice, cost: line.cost },
          `Purchase ${purchase.number}`,
        );
        product.cost = line.cost;
        discountSettings(product, {}, line.sellingPrice);
        product.price = line.sellingPrice;
        movement(product.id, line.quantity, "Purchase", purchase.number);
      }
      s.purchases.unshift(purchase);
      if (purchase.paymentMethod === "cash")
        recordDrawerCash(
          s,
          {
            amount: purchase.paid,
            direction: "out",
            type: "purchase",
            reference: purchase.id,
            note: purchase.number,
          },
          now,
        );
      result = purchase;
      break;
    }
    case "adjust": {
      const product = s.products.find((x) => x.id === p.productId);
      requireThat(product, "Select a product");
      requireThat(
        Number.isFinite(p.quantity) && p.quantity !== 0,
        "Enter a non-zero adjustment",
      );
      positive(Math.abs(p.quantity), "Adjustment quantity");
      requireThat(p.reason?.trim(), "Adjustment reason is required");
      requireThat(product.stock + p.quantity >= 0, "Stock cannot be negative");
      product.stock = money(product.stock + p.quantity);
      movement(product.id, p.quantity, "Adjustment", p.reason.trim());
      break;
    }
    case "hold":
      requireThat(p.items?.length, "Add products first");
      requireThat(
        p.items.every((line) =>
          s.products.some(
            (product) =>
              product.id === line.productId &&
              product.active !== false &&
              !product.deletedAt,
          ),
        ),
        "A held-bill product is unavailable",
      );
      s.held.push({
        ...p,
        items: p.items.map((line) => {
          positive(line.quantity, "Quantity");
          const product = s.products.find((item) => item.id === line.productId);
          return {
            productId: line.productId,
            quantity: line.quantity,
            ...discountSettings(line, product, product.price),
          };
        }),
        id: uid(),
        date: now,
      });
      break;
    case "deleteHold":
      s.held = s.held.filter((x) => x.id !== p.id);
      break;
    case "void": {
      const sale = s.sales.find((x) => x.id === p.id);
      requireThat(sale && !sale.void, "Sale is already void or missing");
      requireThat(p.reason?.trim(), "Void reason required");
      if (sale.customerId)
        requireThat(
          customerBalance(s, sale.customerId) >= sale.total - sale.paid,
          "Refund credit collections before voiding this sale",
        );
      sale.void = true;
      sale.voidReason = p.reason;
      sale.voidDate = now;
      for (const l of sale.items) {
        const product = s.products.find((x) => x.id === l.productId);
        product.stock = money(product.stock + l.quantity);
        movement(product.id, l.quantity, "Void", sale.number);
      }
      result = sale;
      break;
    }
    case "settings":
      requireThat(p.name?.trim(), "Store name required");
      requireThat(p.currency === "LKR", "Currency must be LKR");
      positive(p.taxRate, "Tax rate", true);
      requireThat(p.taxRate <= 100, "Tax rate cannot exceed 100%");
      s.settings = { ...s.settings, ...p };
      break;
    default:
      throw new Error("Unknown operation");
  }
  return { state: s, result };
}

// Explicit dummy template; never imported automatically into an owner's store.
export function seedWithTransactions() {
  let s = seedState();
  s.customers = s.customers.map((c, i) => ({
    ...c,
    code: `CUS-${String(i + 1).padStart(5, "0")}`,
    village: VILLAGES[i],
  }));
  s.suppliers = s.suppliers.map((c, i) => ({
    ...c,
    code: `SUP-${String(i + 1).padStart(5, "0")}`,
  }));
  for (let i = 0; i < 7; i++) {
    const p = s.products[i];
    s = applyAction(s, {
      type: "checkout",
      payload: {
        items: [{ productId: p.id, quantity: 2 }],
        customerId: s.customers[i % 3].id,
        method: i % 3 === 0 ? "credit" : "cash",
        tendered: i % 3 === 0 ? 100 : p.price * 2,
        discount: 0,
      },
    }).state;
    const date = new Date(Date.now() - (6 - i) * 86400000).toISOString();
    s.sales[0].date = date;
    s.movements
      .filter((m) => m.reference === s.sales[0].number)
      .forEach((m) => (m.date = date));
  }
  s = applyAction(s, {
    type: "purchase",
    payload: {
      supplierId: s.suppliers[0].id,
      productId: s.products[0].id,
      quantity: 10,
      cost: 200,
      paid: 1000,
      reference: "DUMMY-PO-001",
    },
  }).state;
  s = applyAction(s, {
    type: "payment",
    payload: {
      customerId: s.customers[0].id,
      amount: 200,
      note: "Dummy credit collection",
    },
  }).state;
  s.seededAt = new Date().toISOString();
  return s;
}
