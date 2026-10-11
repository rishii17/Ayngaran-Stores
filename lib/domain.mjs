export const money = (n) =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;
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
    barcode: `4790001000${String(i + 1).padStart(3, "0")}`,
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
        .reduce((a, x) => a + x.total - x.paid, 0) -
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
export function totals(lines, discount = 0, taxRate = 0) {
  const subtotal = money(
    lines.reduce((a, l) => a + money(l.price * l.quantity), 0),
  );
  const deduction = money(Math.min(subtotal, Math.max(0, discount)));
  const tax = money(((subtotal - deduction) * taxRate) / 100);
  return {
    subtotal,
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
  switch (action.type) {
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
      const item = {
        ...p,
        id: old?.id || uid(),
        name: p.name.trim(),
        active: true,
      };
      if (old) {
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
      };
      if (old) s[key][s[key].indexOf(old)] = item;
      else s[key].push(item);
      result = item;
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
      for (const item of p.items) {
        positive(item.quantity, "Quantity");
        grouped.set(
          item.productId,
          (grouped.get(item.productId) || 0) + item.quantity,
        );
      }
      const items = [...grouped].map(([id, quantity]) => {
        const item = s.products.find((x) => x.id === id && x.active);
        requireThat(item, "Product is unavailable");
        requireThat(
          item.stock >= quantity,
          `Only ${item.stock} ${item.unit} of ${item.name} in stock`,
        );
        return {
          productId: id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          quantity,
          price: item.price,
          cost: item.cost,
        };
      });
      positive(p.discount || 0, "Discount", true);
      const bill = totals(items, p.discount || 0, s.settings.taxRate);
      requireThat(
        (p.discount || 0) <= bill.subtotal,
        "Discount exceeds subtotal",
      );
      const c = s.customers.find((x) => x.id === p.customerId);
      requireThat(!p.customerId || c, "Customer not found");
      positive(p.tendered, "Payment", true);
      const paid = p.method === "credit" ? money(p.tendered) : bill.total;
      requireThat(p.method !== "credit" || c, "Select a customer for credit");
      requireThat(
        p.method !== "credit" || paid <= bill.total,
        "Credit payment exceeds total",
      );
      requireThat(
        p.method !== "cash" || p.tendered >= bill.total,
        "Cash received is less than the total",
      );
      if (c && p.method === "credit")
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
        seller: structuredClone(s.settings),
        items,
        ...bill,
        paid,
        method: p.method,
        tendered: p.tendered,
        change: p.method === "cash" ? money(p.tendered - bill.total) : 0,
        void: false,
      };
      for (const l of items) {
        const item = s.products.find((x) => x.id === l.productId);
        item.stock = money(item.stock - l.quantity);
        movement(item.id, -l.quantity, "Sale", sale.number);
      }
      s.sales.unshift(sale);
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
      const payment = { ...p, id: uid(), date: now, amount: money(p.amount) };
      s.payments.unshift(payment);
      result = payment;
      break;
    }
    case "purchase": {
      requireThat(
        s.suppliers.some((x) => x.id === p.supplierId),
        "Select a supplier",
      );
      const product = s.products.find((x) => x.id === p.productId);
      requireThat(product, "Select a product");
      positive(p.quantity, "Quantity");
      positive(p.cost, "Cost");
      positive(p.paid, "Paid amount", true);
      const total = money(p.quantity * p.cost);
      requireThat(p.paid <= total, "Paid amount exceeds purchase total");
      const purchase = {
        ...p,
        id: uid(),
        date: now,
        total,
        number: `PO-${String(s.purchases.length + 1).padStart(5, "0")}`,
      };
      s.purchases.unshift(purchase);
      product.stock = money(product.stock + p.quantity);
      product.cost = p.cost;
      movement(product.id, p.quantity, "Purchase", purchase.number);
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
      s.held.push({ ...p, id: uid(), date: now });
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
