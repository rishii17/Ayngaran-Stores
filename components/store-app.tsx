"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  ShoppingBasket,
  Package,
  Users,
  Truck,
  ChartNoAxesCombined,
  Settings,
  Search,
  ScanLine,
  Plus,
  Minus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeft,
  Calculator,
  Clock,
  ReceiptText,
  Printer,
  X,
  Check,
  CheckCircle2,
  Wallet,
  Landmark,
  CreditCard,
  Banknote,
  Download,
  SlidersHorizontal,
  Box,
  History,
  Menu,
  LogIn,
  LogOut,
  RefreshCw,
  ImagePlus,
  AlertTriangle,
  Pause,
  ShoppingCart,
  FileText,
  Flower2,
} from "lucide-react";
import ProductArt, { GaneshMark } from "./product-art";
import Scanner from "./scanner";
import { findProductByCode } from "../lib/product-code.mjs";
import HardwareScanner from "./hardware-scanner";
import { authErrorMessage } from "../lib/auth-error.mjs";
import PurchaseForm from "./purchase-form";
import PurchaseComparison from "./purchase-comparison";
import QuickCalculator from "./quick-calculator";
import CustomerPicker from "./customer-picker";
import CustomerBills from "./customer-bills";
import BackupPanel from "./backup-panel";
import {
  VILLAGES,
  searchIndex,
  searchItems,
  contactFields,
  contactCode,
  matchesBill,
} from "@/lib/search.mjs";
import { grossProfit, dailySummary } from "@/lib/reporting.mjs";
import {
  applyAction,
  seedState,
  emptyState,
  customerBalance,
  supplierBalance,
  totals,
  money,
} from "@/lib/domain.mjs";
import { api, csv, download, getSupabase, webp } from "@/lib/client";
const fmt = (v: number) =>
  new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v || 0);
const day = (v: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(v));
const dateLabel = (v: string) =>
  new Date(v).toLocaleString("en-GB", {
    timeZone: "Asia/Colombo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const categories = [
  "All products",
  "Rice & grains",
  "Pulses & spices",
  "Oils & cooking",
  "Dairy & eggs",
  "Beverages",
  "Snacks",
  "Essentials",
];
const navigation = [
  ["Point of sale", ShoppingBasket],
  ["Dashboard", LayoutDashboard],
  ["Products", Package],
  ["Inventory", Box],
  ["Customers", Users],
  ["Suppliers", Truck],
  ["Sales & reports", ChartNoAxesCombined],
] as const;
const blankProduct = {
  name: "",
  tamil: "",
  sku: "",
  barcode: "",
  category: "Rice & grains",
  price: 0,
  cost: 0,
  stock: 0,
  reorder: 10,
  unit: "kg",
  image: "",
  art: "rice",
};
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty">
      <ShoppingBasket size={34} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const node = ref.current;
    node?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const els = node?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,textarea,[tabindex="0"]',
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === node)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={"modal " + (wide ? "modal-wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
      >
        <div className="modal-title">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export default function StoreApp() {
  const [state, setState] = useState<any>(emptyState()),
    [ready, setReady] = useState(false),
    [mode, setMode] = useState<"demo" | "live">("demo"),
    [user, setUser] = useState<any>(null),
    [page, setPage] = useState("Point of sale"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All products"),
    [cart, setCart] = useState<any[]>([]),
    [customerId, setCustomerId] = useState(""),
    [discount, setDiscount] = useState(0),
    [heldId, setHeldId] = useState<string | null>(null),
    [modal, setModal] = useState(""),
    [form, setForm] = useState<any>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [receipt, setReceipt] = useState<any>(null),
    [method, setMethod] = useState("cash"),
    [tendered, setTendered] = useState(""),
    [tableQuery, setTableQuery] = useState(""),
    [stockFilter, setStockFilter] = useState("all"),
    [sidebar, setSidebar] = useState(false),
    [reportDate, setReportDate] = useState(""),
    [reportCustomerId, setReportCustomerId] = useState(""),
    [authMode, setAuthMode] = useState("signin");
  const searchRef = useRef<HTMLInputElement>(null),
    stateRef = useRef(state),
    busyRef = useRef(false),
    requestRef = useRef<any>(null);
  stateRef.current = state;
  const notify = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 4000);
  };
  useEffect(() => {
    try {
      const data = localStorage.getItem("ayngaran-demo-v1");
      setState(data ? JSON.parse(data).state : seedState());
    } catch {
      setError(
        "Saved sample data could not be read. Export or clear browser storage before continuing.",
      );
    }
    const sb = getSupabase();
    if (sb) {
      sb.auth
        .getSession()
        .then(async ({ data }) => {
          if (data.session) {
            setUser(data.session.user);
            if (localStorage.getItem("ayngaran-mode") === "live") {
              setMode("live");
              setState(emptyState());
              try {
                const saved = await api("state");
                setState(saved.state);
              } catch (err: any) {
                setError(
                  "Could not load your live store: " +
                    err.message +
                    ". Open Account and retry.",
                );
              }
            }
          }
        })
        .catch((err: any) => setError(err.message))
        .finally(() => setReady(true));
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        setUser(session?.user || null);
        if (event === "SIGNED_OUT") {
          setState(emptyState());
          setCart([]);
          setCustomerId("");
          setDiscount(0);
          setHeldId(null);
          setReceipt(null);
        }
      });
      return () => data.subscription.unsubscribe();
    }
    setReady(true);
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (modal || e.isComposing) return;
      if (e.key === "F2") {
        e.preventDefault();
        setPage("Point of sale");
        searchRef.current?.focus();
      }
      if (e.key === "F4") {
        e.preventDefault();
        setModal("scanner");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modal]);
  const close = () => {
    if (!busyRef.current) {
      setModal("");
      setError("");
    }
  };
  async function switchLive() {
    setBusy(true);
    setError("");
    try {
      const data = await api("state");
      setState(data.state);
      setMode("live");
      localStorage.setItem("ayngaran-mode", "live");
      setCart([]);
      setCustomerId("");
      setDiscount(0);
      setHeldId(null);
      setModal("");
      notify("Connected to your live store");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function act(type: string, payload: any) {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const signature = JSON.stringify({ type, payload });
      if (requestRef.current?.signature !== signature)
        requestRef.current = { signature, id: crypto.randomUUID() };
      let response: any;
      if (mode === "live") {
        response = await api("actions", {
          method: "POST",
          body: JSON.stringify({ id: requestRef.current.id, type, payload }),
        });
      } else {
        const run = () => {
          const saved = localStorage.getItem("ayngaran-demo-v1");
          const data = saved
            ? JSON.parse(saved)
            : { state: stateRef.current, receipts: {} };
          if (data.receipts?.[requestRef.current.id])
            return {
              state: data.state,
              result: data.receipts[requestRef.current.id],
            };
          const changed = applyAction(data.state, { type, payload });
          localStorage.setItem(
            "ayngaran-demo-v1",
            JSON.stringify({
              state: changed.state,
              receipts: {
                ...data.receipts,
                [requestRef.current.id]: changed.result,
              },
            }),
          );
          return changed;
        };
        response = navigator.locks
          ? await navigator.locks.request("ayngaran-demo", run)
          : run();
      }
      setState(response.state);
      requestRef.current = null;
      return response;
    } catch (e: any) {
      setError(
        e.name === "QuotaExceededError"
          ? "Browser storage is full. Remove large images or use the live store. Your operation was not saved."
          : e.message,
      );
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const lines = cart.map((l) => ({
    ...state.products.find((p: any) => p.id === l.productId),
    ...l,
  }));
  const total = totals(lines, discount, state.settings.taxRate);
  const quantity = money(cart.reduce((a, l) => a + l.quantity, 0));
  const lowStock = state.products.filter((p: any) => p.stock <= p.reorder);
  const today = day(new Date().toISOString());
  const todaySales = state.sales.filter(
    (s: any) => !s.void && day(s.date) === today,
  );
  const outstanding = state.customers.reduce(
    (a: number, c: any) => a + customerBalance(state, c.id),
    0,
  );
  const selectedCustomer = state.customers.find(
    (c: any) => c.id === customerId,
  );
  const checkoutCredit =
    method === "card"
      ? 0
      : Math.max(0, Math.round((total.total - Number(tendered)) * 100) / 100);
  const checkoutBalance = selectedCustomer
    ? Math.round((customerBalance(state, customerId) + checkoutCredit) * 100) /
      100
    : checkoutCredit;
  const creditLimitExceeded =
    checkoutCredit > 0 &&
    selectedCustomer &&
    checkoutBalance > selectedCustomer.creditLimit;
  function addProduct(p: any) {
    const old = cart.find((l) => l.productId === p.id);
    if ((old?.quantity || 0) + 1 > p.stock) {
      notify(`${p.name}: insufficient stock`);
      return;
    }
    setCart(
      old
        ? cart.map((l) =>
            l.productId === p.id
              ? { ...l, quantity: money(l.quantity + 1) }
              : l,
          )
        : [...cart, { productId: p.id, quantity: 1 }],
    );
  }
  function setQuantity(id: string, q: number) {
    const product = state.products.find((p: any) => p.id === id);
    if (q > product.stock) {
      notify(`Only ${product.stock} ${product.unit} available`);
      return;
    }
    if (q <= 0) setCart(cart.filter((l) => l.productId !== id));
    else
      setCart(
        cart.map((l) =>
          l.productId === id ? { ...l, quantity: money(q) } : l,
        ),
      );
  }
  function scan(value: string) {
    const product = findProductByCode(state.products, value);
    setModal("");
    if (product) {
      addProduct(product);
      notify(`${product.name} added to bill`);
    } else {
      setQuery(value);
      notify(`No product found for ${value}`);
    }
  }
  function openForm(name: string, data: any = {}) {
    setError("");
    setForm(data);
    setModal(name);
  }
  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    const result = await act(modal, form);
    if (result) {
      if (modal === "customer" && page === "Point of sale") {
        setCustomerId(result.result.id);
      }
      setModal("");
      notify("Saved successfully");
    }
  }
  const update = (key: string, value: any) =>
    setForm((prev: any) => ({ ...prev, [key]: value }));
  function exportSales() {
    download(
      "ayngaran-sales.csv",
      csv([
        [
          "Bill",
          "Date",
          "Customer",
          "Payment",
          "Total LKR",
          "Paid LKR",
          "Credit LKR",
          "Status",
        ],
        ...state.sales.map((s: any) => [
          s.number,
          s.date,
          s.customerName,
          s.method,
          s.total,
          s.paid,
          money(s.total - s.paid),
          s.void ? "VOID" : "Completed",
        ]),
      ]),
      "text/csv",
    );
  }
  async function checkout() {
    const response = await act("checkout", {
      items: cart,
      customerId: customerId || null,
      discount,
      method,
      tendered: Number(tendered) || 0,
      heldId,
    });
    if (response) {
      setReceipt(response.result);
      setCart([]);
      setCustomerId("");
      setDiscount(0);
      setHeldId(null);
      setModal("receipt");
      notify("Bill saved and stock updated");
    }
  }
  async function holdBill() {
    const result = await act("hold", {
      items: cart,
      customerId: customerId || null,
      discount,
      label: selectedCustomer?.name || `Walk-in · ${cart.length} items`,
    });
    if (result) {
      setCart([]);
      setCustomerId("");
      setDiscount(0);
      setHeldId(null);
      notify("Bill held");
    }
  }
  const productIndex = useMemo(
    () =>
      searchIndex(state.products, (p: any) => [
        p.name,
        p.tamil,
        p.sku,
        p.barcode,
        p.category,
      ]),
    [state.products],
  );
  const filteredProducts = useMemo(
    () =>
      searchItems(productIndex, query).filter(
        (p: any) =>
          p.active && (category === "All products" || p.category === category),
      ),
    [productIndex, query, category],
  );
  const tableProducts = useMemo(
    () =>
      searchItems(productIndex, tableQuery).filter(
        (p: any) => stockFilter !== "low" || p.stock <= p.reorder,
      ),
    [productIndex, tableQuery, stockFilter],
  );
  const contacts = state[page === "Suppliers" ? "suppliers" : "customers"];
  const contactIndex = useMemo(
    () => searchIndex(contacts, contactFields),
    [contacts],
  );
  const tableContacts = useMemo(
    () => searchItems(contactIndex, tableQuery),
    [contactIndex, tableQuery],
  );
  const reportSales = useMemo(
    () =>
      state.sales.filter(
        (s: any) =>
          (!reportDate || day(s.date) === reportDate) &&
          (!reportCustomerId || s.customerId === reportCustomerId) &&
          matchesBill(s, tableQuery, state.customers),
      ),
    [state.sales, state.customers, reportDate, reportCustomerId, tableQuery],
  );
  const villages = [
    ...new Set([
      ...VILLAGES,
      ...(state.villages || []),
      ...state.customers.map((c: any) => c.village).filter(Boolean),
    ]),
  ];
  const showCustomerBills = (id: string) => {
    setReportCustomerId(id);
    setReportDate("");
    setTableQuery("");
    setPage("Sales & reports");
    setModal("");
  };
  const subtitle: Record<string, string> = {
    "Point of sale": "A little less effort. A better day at the counter.",
    Dashboard: "A clear picture of your business, every day.",
    Products: "Everything on your shelves, in one place.",
    Inventory: "Know what comes in, what goes out, and what’s running low.",
    Customers: "Build relationships. Keep every balance clear.",
    Suppliers: "Your partners, purchases, and payables.",
    "Sales & reports": "Every bill. Every payment. The complete picture.",
    Settings: "Make Ayngaran Stores feel like your store.",
  };
  if (!ready)
    return (
      <div className="loading">
        <GaneshMark />
        <p>Opening Ayngaran Stores…</p>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (sidebar ? "is-open" : "")}>
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-mark">
            <GaneshMark />
          </span>
          <span>
            AYNGARAN<small>STORES</small>
          </span>
        </a>
        <div className="store-switch">
          <span className="store-icon">
            <ShoppingBasket size={18} />
          </span>
          <span>
            Main store<small>Jaffna, Sri Lanka</small>
          </span>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navigation.map(([name, Icon]) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              onClick={() => {
                setPage(name);
                setTableQuery("");
                setSidebar(false);
              }}
            >
              <Icon size={19} />
              <span>{name}</span>
              {name === "Inventory" && lowStock.length > 0 && (
                <span className="nav-count">{lowStock.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="blessing">
            <Flower2 size={22} />
            <span>
              Good beginnings.
              <br />
              <strong>Growing together.</strong>
            </span>
          </div>
          <button
            className={"nav-settings " + (page === "Settings" ? "active" : "")}
            onClick={() => setPage("Settings")}
          >
            <Settings size={18} />
            Settings
          </button>
          <div className="profile">
            <span className="avatar">
              {user?.email?.[0]?.toUpperCase() || "AS"}
            </span>
            <div>
              <strong>{user?.email?.split("@")[0] || "Store owner"}</strong>
              <small>
                {mode === "live" ? "Live workspace" : "Sample workspace"}
              </small>
            </div>
            <button
              className="icon-button"
              title="Account"
              onClick={() => setModal("account")}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              onClick={() => setSidebar(!sidebar)}
              aria-label="Toggle navigation"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <span className={"connection " + (mode === "live" ? "live" : "")}>
              <i />
              {mode === "live" ? "Cloud connected" : "Sample mode"}
            </span>
            <span className="top-date">
              {new Date().toLocaleDateString("en-GB", {
                timeZone: "Asia/Colombo",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <button
              className="icon-button"
              title="Calculator"
              onClick={() => setModal("calculator")}
            >
              <Calculator size={19} />
            </button>
            <span className="avatar small">AS</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                AYNGARAN STORES <span>•</span>{" "}
                {page === "Point of sale"
                  ? "THE EVERYDAY, MADE EASIER"
                  : "YOUR BUSINESS AT A GLANCE"}
              </div>
              <h1>{page}</h1>
              <p>{subtitle[page]}</p>
            </div>
            <div className="heading-actions">
              {page === "Point of sale" ? (
                <>
                  <button className="button" onClick={() => setModal("held")}>
                    <Clock size={17} />
                    Held bills{" "}
                    <span className="badge">{state.held.length}</span>
                  </button>
                  <button
                    className="button"
                    onClick={() => openForm("product", { ...blankProduct })}
                  >
                    <Plus size={17} />
                    Add product
                  </button>
                </>
              ) : page === "Products" ? (
                <button
                  className="primary"
                  onClick={() => openForm("product", { ...blankProduct })}
                >
                  <Plus size={17} />
                  Add product
                </button>
              ) : page === "Customers" || page === "Suppliers" ? (
                <button
                  className="primary"
                  onClick={() =>
                    openForm(page === "Customers" ? "customer" : "supplier", {
                      name: "",
                      phone: "",
                      address: "",
                      openingBalance: 0,
                      creditLimit: 10000,
                    })
                  }
                >
                  <Plus size={17} />
                  Add {page === "Customers" ? "customer" : "supplier"}
                </button>
              ) : page === "Inventory" ? (
                <button
                  className="primary"
                  onClick={() =>
                    openForm("adjust", {
                      productId: "",
                      quantity: 0,
                      reason: "",
                    })
                  }
                >
                  <SlidersHorizontal size={17} />
                  Adjust stock
                </button>
              ) : page === "Sales & reports" ? (
                <button className="button" onClick={exportSales}>
                  <Download size={17} />
                  Export sales
                </button>
              ) : null}
            </div>
          </div>
          {mode === "demo" && (
            <div className="demo-banner">
              <span>
                <span className="demo-dot" />
                You’re exploring sample data. Changes are saved in this browser.
              </span>
              <button
                onClick={() => (user ? switchLive() : setModal("account"))}
              >
                Open live store <ArrowUpRight size={14} />
              </button>
            </div>
          )}
          {error && !modal && (
            <div className="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {page === "Point of sale" && (
            <div className="pos-layout">
              <section className="catalog">
                <HardwareScanner
                  disabled={Boolean(modal) || busy}
                  onCode={(value) => {
                    const p = findProductByCode(state.products, value);
                    if (!p)
                      return "No matching product; check the desktop catalog.";
                    if (
                      p.stock <
                      1 +
                        (cart.find((l) => l.productId === p.id)?.quantity || 0)
                    )
                      return "Not added: insufficient stock.";
                    addProduct(p);
                    return `${p.name} added to bill.`;
                  }}
                />

                <div className="catalog-tools">
                  <div className="search-box">
                    <Search size={20} />
                    <input
                      ref={searchRef}
                      placeholder="Search name, SKU or scan a barcode…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const exact = findProductByCode(
                            state.products,
                            query,
                          );
                          if (exact || filteredProducts.length === 1) {
                            addProduct(exact || filteredProducts[0]);
                            setQuery("");
                          }
                        }
                      }}
                    />
                    <kbd>F2</kbd>
                    {query && (
                      <button
                        className="icon-button"
                        onClick={() => setQuery("")}
                        aria-label="Clear search"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <button
                    className="scan-button"
                    title="Scan barcode (F4)"
                    onClick={() => setModal("scanner")}
                  >
                    <ScanLine size={21} />
                    <span>Scan</span>
                  </button>
                </div>
                <div className="category-tabs">
                  {categories.map((c, i) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={category === c ? "selected" : ""}
                    >
                      {i === 0 && <LayoutDashboard size={15} />} {c}
                    </button>
                  ))}
                </div>
                <div className="catalog-label">
                  <span>
                    {category}
                    <small>{filteredProducts.length} products</small>
                  </span>
                  <span className="muted">
                    Click a product to add <Plus size={13} />
                  </span>
                </div>
                <div className="product-grid">
                  {filteredProducts.map((p: any) => (
                    <button
                      key={p.id}
                      className={
                        "product-card " + (p.stock === 0 ? "sold-out" : "")
                      }
                      onClick={() => addProduct(p)}
                      disabled={p.stock === 0}
                    >
                      <div className={"product-visual tone-" + p.art}>
                        <ProductArt product={p} />
                        {p.stock <= p.reorder && (
                          <span className="low-tag">
                            {p.stock === 0 ? "Out of stock" : "Low stock"}
                          </span>
                        )}
                        <span className="add-product">
                          <Plus size={17} />
                        </span>
                      </div>
                      <div className="product-info">
                        <span className="product-category">{p.category}</span>
                        <h3 title={p.tamil ? `${p.name} / ${p.tamil}` : p.name}>
                          {p.name}
                          {p.tamil && (
                            <>
                              {" "}
                              / <span lang="ta">{p.tamil}</span>
                            </>
                          )}
                        </h3>
                        <div className="product-bottom">
                          <strong>
                            <small>Rs.</small> {fmt(p.price)}
                          </strong>
                          <span>/ {p.unit}</span>
                        </div>
                        <div className="stock-line">
                          <i className={p.stock <= p.reorder ? "low" : ""} />
                          {p.stock} {p.unit} in stock
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {!filteredProducts.length && (
                  <Empty
                    title="No products found"
                    detail="Try another name, SKU or barcode, or add a new product."
                  />
                )}
                <div className="catalog-footer">
                  <span>
                    <ScanLine size={14} />
                    USB barcode scanners work in the search field
                  </span>
                  <span>Prices in LKR</span>
                </div>
              </section>
              <aside className="bill-panel">
                <div className="bill-title">
                  <div>
                    <ReceiptText size={21} />
                    <h2>Current bill</h2>
                  </div>
                  <span className="bill-number">
                    #{String(state.sales.length + 1).padStart(5, "0")}
                  </span>
                </div>
                <div className="customer-select">
                  <Users size={18} />
                  <CustomerPicker
                    customers={state.customers}
                    value={customerId}
                    onChange={setCustomerId}
                  />
                  <button
                    title="Add customer"
                    onClick={() =>
                      openForm("customer", {
                        name: "",
                        phone: "",
                        address: "",
                        openingBalance: 0,
                        creditLimit: 10000,
                      })
                    }
                  >
                    <Plus size={18} />
                  </button>
                </div>
                {selectedCustomer && (
                  <div className="customer-credit">
                    <span>
                      {selectedCustomer.village || "No village"} ·{" "}
                      {contactCode(selectedCustomer)}
                      <br />
                      Outstanding: Rs. {fmt(customerBalance(state, customerId))}
                    </span>
                    <button
                      className="text-button"
                      onClick={() => showCustomerBills(customerId)}
                    >
                      View bills
                    </button>
                  </div>
                )}
                <div className="bill-items-header">
                  <span>
                    ITEM <small>({cart.length})</small>
                  </span>
                  <span>AMOUNT</span>
                </div>
                <div className="bill-items">
                  {lines.length ? (
                    lines.map((l: any) => (
                      <div className="bill-item" key={l.productId}>
                        <div className="bill-item-top">
                          <strong
                            title={l.tamil ? `${l.name} / ${l.tamil}` : l.name}
                          >
                            {l.name}
                            {l.tamil && (
                              <>
                                {" "}
                                / <span lang="ta">{l.tamil}</span>
                              </>
                            )}
                          </strong>
                          <button
                            aria-label={"Remove " + l.name}
                            onClick={() => setQuantity(l.productId, 0)}
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="bill-item-meta">
                          <span>
                            Rs. {fmt(l.price)} / {l.unit}
                          </span>
                        </div>
                        <div className="bill-item-bottom">
                          <div className="quantity-control">
                            <button
                              aria-label={"Decrease " + l.name}
                              onClick={() =>
                                setQuantity(l.productId, l.quantity - 1)
                              }
                            >
                              <Minus size={13} />
                            </button>
                            <QuantityInput
                              name={l.name}
                              value={l.quantity}
                              onCommit={(q) => setQuantity(l.productId, q)}
                            />
                            <button
                              aria-label={"Increase " + l.name}
                              onClick={() =>
                                setQuantity(l.productId, l.quantity + 1)
                              }
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                          <strong>{fmt(l.price * l.quantity)}</strong>
                        </div>
                        <div
                          className="quantity-presets"
                          role="group"
                          aria-label={"Quick quantity for " + l.name}
                        >
                          {(l.unit === "g"
                            ? [250, 500, 1000, 2000]
                            : ["kg", "litre", "bottle"].includes(l.unit)
                              ? [0.25, 0.5, 1, 2]
                              : [1, 2, 3, 4]
                          ).map((q) => (
                            <button
                              key={q}
                              type="button"
                              aria-pressed={l.quantity === q}
                              disabled={q > l.stock}
                              onClick={() => setQuantity(l.productId, q)}
                            >
                              {["litre", "bottle"].includes(l.unit) && q < 1
                                ? q === 0.25
                                  ? "¼"
                                  : "½"
                                : q}{" "}
                              {l.unit}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-bill">
                      <div>
                        <ShoppingBasket size={32} />
                      </div>
                      <h3>Your next sale starts here</h3>
                      <p>
                        Search or scan a product
                        <br />
                        to add it to this bill.
                      </p>
                      <span>
                        Quick search <kbd>F2</kbd> <span>·</span> Scan{" "}
                        <kbd>F4</kbd>
                      </span>
                    </div>
                  )}
                </div>
                <div className="bill-summary">
                  <div>
                    <span>
                      Subtotal <small>({quantity} units)</small>
                    </span>
                    <strong>Rs. {fmt(total.subtotal)}</strong>
                  </div>
                  <div>
                    <label htmlFor="discount">
                      Discount <span className="muted">LKR</span>
                    </label>
                    <input
                      id="discount"
                      type="number"
                      min="0"
                      max={total.subtotal}
                      value={discount || ""}
                      placeholder="0.00"
                      onChange={(e) =>
                        setDiscount(Math.max(0, Number(e.target.value)))
                      }
                    />
                  </div>
                  <div>
                    <span>Tax ({state.settings.taxRate}%)</span>
                    <strong>Rs. {fmt(total.tax)}</strong>
                  </div>
                  <div className="total-row">
                    <span>Total payable</span>
                    <strong>
                      <small>Rs.</small> {fmt(total.total)}
                    </strong>
                  </div>
                  <button
                    className="checkout primary"
                    disabled={!cart.length || busy}
                    onClick={() => {
                      setMethod("cash");
                      setTendered(String(total.total));
                      setModal("checkout");
                    }}
                  >
                    <span>Charge Rs. {fmt(total.total)}</span>
                    <ArrowUpRight size={21} />
                  </button>
                  <div className="bill-bottom-actions">
                    <button
                      disabled={!cart.length || busy || !!heldId}
                      onClick={holdBill}
                    >
                      <Pause size={15} />
                      Hold bill
                    </button>
                    <span />
                    <button
                      disabled={!cart.length || busy}
                      onClick={() => setModal("clear")}
                    >
                      <Trash2 size={15} />
                      Clear bill
                    </button>
                  </div>
                  <div className="bill-security">
                    <CheckCircle2 size={12} />
                    {mode === "live"
                      ? "Saved securely to your store"
                      : "Sample bills saved on this device"}
                  </div>
                </div>
              </aside>
            </div>
          )}
          {page === "Dashboard" && (
            <>
              <div className="stats-grid">
                <Stat
                  title="Today’s sales"
                  value={
                    "Rs. " +
                    fmt(
                      todaySales.reduce((a: number, s: any) => a + s.total, 0),
                    )
                  }
                  icon={ChartNoAxesCombined}
                  note="Completed bills · Sri Lanka time"
                />
                <Stat
                  title="Bills today"
                  value={todaySales.length}
                  icon={ReceiptText}
                  note="Every transaction accounted for"
                />
                <Stat
                  title="Customer credit"
                  value={"Rs. " + fmt(outstanding)}
                  icon={Wallet}
                  note={`${state.customers.filter((c: any) => customerBalance(state, c.id) > 0).length} customers with a balance`}
                />
                <Stat
                  title="Low-stock products"
                  value={lowStock.length}
                  icon={Package}
                  note="At or below reorder level"
                />
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Sales this week</h2>
                      <p>Your daily sales, at a glance</p>
                    </div>
                    <span className="pill">Last 7 days</span>
                  </div>
                  <SalesChart sales={state.sales} />
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Needs your attention</h2>
                      <p>A little planning goes a long way</p>
                    </div>
                    <span className="warning-icon">
                      <AlertTriangle size={19} />
                    </span>
                  </div>
                  {lowStock.slice(0, 5).map((p: any) => (
                    <div className="attention-row" key={p.id}>
                      <span className="mini-art">
                        <ProductArt product={p} />
                      </span>
                      <div>
                        <strong>{p.name}</strong>
                        <small>
                          Reorder at {p.reorder} {p.unit}
                        </small>
                      </div>
                      <span className="status amber">{p.stock} left</span>
                    </div>
                  ))}
                  <button
                    className="text-button"
                    onClick={() => setPage("Inventory")}
                  >
                    View inventory <ChevronRight size={16} />
                  </button>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Recent sales</h2>
                    <p>Your latest moments at the counter</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setPage("Sales & reports")}
                  >
                    View all <ChevronRight size={16} />
                  </button>
                </div>
                {salesTable(state.sales.slice(0, 5))}
              </section>
            </>
          )}
          {(page === "Products" || page === "Inventory") && (
            <>
              <div className="stats-grid three">
                <Stat
                  title="Total products"
                  value={state.products.length}
                  icon={Package}
                  note="Active products in your catalogue"
                />
                <Stat
                  title="Stock value at cost"
                  value={
                    "Rs. " +
                    fmt(
                      state.products.reduce(
                        (a: number, p: any) => a + p.stock * p.cost,
                        0,
                      ),
                    )
                  }
                  icon={Wallet}
                  note="Current quantity × purchase cost"
                />
                <Stat
                  title="Low stock"
                  value={lowStock.length}
                  icon={AlertTriangle}
                  note="Plan your next purchase"
                />
              </div>
              <section className="panel">
                <div className="table-toolbar">
                  <div className="search-box">
                    <Search size={18} />
                    <input
                      placeholder="Search products, SKU or barcode"
                      value={tableQuery}
                      onChange={(e) => setTableQuery(e.target.value)}
                    />
                  </div>
                  <select
                    aria-label="Stock filter"
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value)}
                  >
                    <option value="all">All stock levels</option>
                    <option value="low">Low stock only</option>
                  </select>
                  <button
                    className="button"
                    onClick={() =>
                      download(
                        "products.csv",
                        csv([
                          [
                            "Name",
                            "SKU",
                            "Barcode",
                            "Price",
                            "Cost",
                            "Stock",
                            "Unit",
                          ],
                          ...tableProducts.map((p: any) => [
                            p.name,
                            p.sku,
                            p.barcode,
                            p.price,
                            p.cost,
                            p.stock,
                            p.unit,
                          ]),
                        ]),
                        "text/csv",
                      )
                    }
                  >
                    <Download size={16} />
                    Export
                  </button>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU / Barcode</th>
                        <th>Selling price</th>
                        <th>Cost</th>
                        <th>Stock on hand</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {tableProducts.map((p: any) => (
                        <tr key={p.id}>
                          <td>
                            <div className="product-cell">
                              <span className="mini-art">
                                <ProductArt product={p} />
                              </span>
                              <div>
                                <strong>{p.name}</strong>
                                <small>{p.category}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            {p.sku}
                            <small>{p.barcode || "No barcode"}</small>
                          </td>
                          <td>Rs. {fmt(p.price)}</td>
                          <td>Rs. {fmt(p.cost)}</td>
                          <td>
                            <strong>{p.stock}</strong> {p.unit}
                          </td>
                          <td>
                            <span
                              className={
                                "status " +
                                (p.stock <= p.reorder ? "amber" : "green")
                              }
                            >
                              {p.stock === 0
                                ? "Out of stock"
                                : p.stock <= p.reorder
                                  ? "Low stock"
                                  : "In stock"}
                            </span>
                          </td>
                          <td>
                            {page === "Products" && (
                              <button
                                className="text-button"
                                onClick={() =>
                                  openForm("price", {
                                    productId: p.id,
                                    price: p.price,
                                    cost: p.cost,
                                    reason: "",
                                  })
                                }
                              >
                                Price
                              </button>
                            )}
                            <button
                              className="text-button"
                              onClick={() =>
                                page === "Products"
                                  ? openForm("product", { ...p })
                                  : openForm("adjust", {
                                      productId: p.id,
                                      quantity: 0,
                                      reason: "",
                                    })
                              }
                            >
                              {page === "Products" ? "Edit" : "Adjust"}{" "}
                              <ChevronRight size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!tableProducts.length && (
                    <Empty
                      title="No products yet"
                      detail="Add your first product to start building your catalogue."
                    />
                  )}
                </div>
              </section>
              {page === "Inventory" && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Stock movement history</h2>
                      <p>Sales, purchases, opening stock and adjustments</p>
                    </div>
                    <History size={20} />
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Product</th>
                          <th>Movement</th>
                          <th>Quantity</th>
                          <th>Reference / reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.movements.slice(0, 100).map((m: any) => (
                          <tr key={m.id}>
                            <td>{dateLabel(m.date)}</td>
                            <td>
                              {
                                state.products.find(
                                  (p: any) => p.id === m.productId,
                                )?.name
                              }
                            </td>
                            <td>{m.type}</td>
                            <td
                              className={
                                m.quantity > 0 ? "positive" : "negative"
                              }
                            >
                              {m.quantity > 0 ? "+" : ""}
                              {m.quantity}
                            </td>
                            <td>{m.reference}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!state.movements.length && (
                      <Empty
                        title="No movements recorded"
                        detail="Stock changes will appear here as you trade."
                      />
                    )}
                  </div>
                </section>
              )}
            </>
          )}
          {page === "Products" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Price change history</h2>
                  <p>Selling price and cost changes, including purchases</p>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Product</th>
                      <th>Selling price</th>
                      <th>Cost</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.priceHistory || []).slice(0, 100).map((h: any) => (
                      <tr key={h.id}>
                        <td>{dateLabel(h.date)}</td>
                        <td>
                          {
                            state.products.find(
                              (p: any) => p.id === h.productId,
                            )?.name
                          }
                        </td>
                        <td>
                          {fmt(h.oldPrice)} → {fmt(h.newPrice)}
                        </td>
                        <td>
                          {fmt(h.oldCost)} → {fmt(h.newCost)}
                        </td>
                        <td>{h.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!state.priceHistory?.length && (
                  <p className="muted history-empty">No price changes yet.</p>
                )}
              </div>
            </section>
          )}
          {(page === "Customers" || page === "Suppliers") && (
            <>
              {page === "Suppliers" && (
                <div className="purchase-banner">
                  <div>
                    <Truck size={27} />
                    <span>
                      <strong>Keep your shelves ready for tomorrow.</strong>
                      <small>
                        Record a purchase to update stock and supplier balances
                        together.
                      </small>
                    </span>
                  </div>
                  <button
                    className="primary"
                    onClick={() =>
                      openForm("purchase", {
                        supplierId: "",
                        productId: "",
                        quantity: 1,
                        cost: 0,
                        paid: 0,
                        reference: "",
                      })
                    }
                  >
                    <Plus size={17} />
                    Record purchase
                  </button>
                </div>
              )}
              {page === "Suppliers" && (
                <PurchaseComparison products={state.products} suppliers={state.suppliers} purchases={state.purchases} />
              )}
              <section className="panel">
                <div className="table-toolbar">
                  <div className="search-box">
                    <Search size={18} />
                    <input
                      placeholder={
                        "Search " +
                        page.toLowerCase() +
                        " by name, phone, ID or village"
                      }
                      value={tableQuery}
                      onChange={(e) => setTableQuery(e.target.value)}
                    />
                  </div>
                  <span className="muted">
                    {
                      state[page === "Customers" ? "customers" : "suppliers"]
                        .length
                    }{" "}
                    {page.toLowerCase()}
                  </span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>
                          {page === "Customers" ? "Customer" : "Supplier"}
                        </th>
                        <th>Phone</th>
                        <th>Address</th>
                        <th>Outstanding balance</th>
                        {page === "Customers" && <th>Credit limit</th>}
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {tableContacts.map((c: any) => {
                        const balance =
                          page === "Customers"
                            ? customerBalance(state, c.id)
                            : supplierBalance(state, c.id);
                        return (
                          <tr key={c.id}>
                            <td>
                              <div className="person-cell">
                                <span className="person-avatar">
                                  {c.name
                                    .split(" ")
                                    .map((s: string) => s[0])
                                    .slice(0, 2)
                                    .join("")}
                                </span>
                                <div>
                                  <strong>{c.name}</strong>
                                  <small>
                                    {contactCode(c)} ·{" "}
                                    {c.village || "No village"}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td>{c.phone || "—"}</td>
                            <td>{c.address || "—"}</td>
                            <td>
                              <strong
                                className={
                                  balance > 0 ? "negative" : "positive"
                                }
                              >
                                Rs. {fmt(balance)}
                              </strong>
                            </td>
                            {page === "Customers" && (
                              <td>Rs. {fmt(c.creditLimit)}</td>
                            )}
                            <td>
                              <button
                                className="text-button"
                                onClick={() =>
                                  openForm("ledger", {
                                    ...c,
                                    kind:
                                      page === "Customers"
                                        ? "customer"
                                        : "supplier",
                                  })
                                }
                              >
                                View account <ChevronRight size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
              {page === "Suppliers" && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Purchase history</h2>
                      <p>Goods received and payments recorded</p>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Purchase</th>
                          <th>Date</th>
                          <th>Supplier</th>
                          <th>Product</th>
                          <th>Total</th>
                          <th>Paid</th>
                          <th>Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.purchases.map((p: any) => (
                          <tr key={p.id}>
                            <td>{p.number}</td>
                            <td>{dateLabel(p.date)}</td>
                            <td>
                              {
                                state.suppliers.find(
                                  (x: any) => x.id === p.supplierId,
                                )?.name
                              }
                            </td>
                            <td>
                              {(p.items || [p]).map((line: any) => (
                                <div key={line.productId}>
                                  {line.name ||
                                    state.products.find(
                                      (x: any) => x.id === line.productId,
                                    )?.name}{" "}
                                  × {line.quantity} · cost {fmt(line.cost)}
                                  {line.sellingPrice != null
                                    ? ` / sell ${fmt(line.sellingPrice)}`
                                    : ""}
                                </div>
                              ))}
                            </td>
                            <td>{fmt(p.total)}</td>
                            <td>{fmt(p.paid)}</td>
                            <td>{p.reference || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!state.purchases.length && (
                      <Empty
                        title="No purchases recorded"
                        detail="Record incoming stock with the purchase button above."
                      />
                    )}
                  </div>
                </section>
              )}
            </>
          )}
          {page === "Sales & reports" && (
            <>
              <div className="stats-grid">
                <Stat
                  title="Sales total"
                  value={
                    "Rs. " +
                    fmt(
                      reportSales
                        .filter((s: any) => !s.void)
                        .reduce((a: number, s: any) => a + s.total, 0),
                    )
                  }
                  icon={ChartNoAxesCombined}
                  note="After discounts · excluding voids"
                />
                <Stat
                  title="Collected on bills"
                  value={
                    "Rs. " +
                    fmt(
                      reportSales
                        .filter((s: any) => !s.void)
                        .reduce((a: number, s: any) => a + s.paid, 0),
                    )
                  }
                  icon={Banknote}
                  note="Cash, card and initial payments"
                />
                <Stat
                  title="Credit issued"
                  value={
                    "Rs. " +
                    fmt(
                      reportSales
                        .filter((s: any) => !s.void)
                        .reduce((a: number, s: any) => a + s.total - s.paid, 0),
                    )
                  }
                  icon={Wallet}
                  note="Before subsequent collections"
                />
                <Stat
                  title="Gross profit"
                  value={
                    "Rs. " +
                    fmt(
                      reportSales
                        .filter((s: any) => !s.void)
                        .reduce((a: number, s: any) => a + grossProfit(s), 0),
                    )
                  }
                  icon={ChartNoAxesCombined}
                  note="Excludes taxes and overheads"
                />
              </div>
              <section className="panel">
                <div className="table-toolbar">
                  <div className="search-box">
                    <Search size={18} />
                    <input
                      placeholder="Search bill, sale ID, customer, phone or village"
                      value={tableQuery}
                      onChange={(e) => setTableQuery(e.target.value)}
                    />
                  </div>
                  <select
                    aria-label="Filter bills by customer"
                    value={reportCustomerId}
                    onChange={(e) => setReportCustomerId(e.target.value)}
                  >
                    <option value="">All customers</option>
                    {state.customers.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.village || contactCode(c)}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Filter sales by date"
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                  />
                  <button
                    className="button"
                    onClick={() => setReportDate(reportDate ? "" : today)}
                  >
                    {reportDate ? "All dates" : "Today"}
                  </button>
                </div>
                {salesTable(reportSales)}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Credit collections & supplier payments</h2>
                    <p>
                      Subsequent payments, separate from initial bill payments
                    </p>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Account</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.payments
                        .filter(
                          (p: any) => !reportDate || day(p.date) === reportDate,
                        )
                        .map((p: any) => (
                          <tr key={p.id}>
                            <td>{dateLabel(p.date)}</td>
                            <td>
                              {
                                (p.customerId
                                  ? state.customers
                                  : state.suppliers
                                ).find(
                                  (c: any) =>
                                    c.id === (p.customerId || p.supplierId),
                                )?.name
                              }
                            </td>
                            <td>
                              {p.customerId
                                ? "Credit collected"
                                : "Supplier paid"}
                            </td>
                            <td>Rs. {fmt(p.amount)}</td>
                            <td>{p.note || "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {page === "Settings" && (
            <div className="settings-layout">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Store & receipt details</h2>
                    <p>Shown on every receipt you print</p>
                  </div>
                  <Settings size={20} />
                </div>
                <form
                  className="settings-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    const result = await act("settings", {
                      name: data.get("name"),
                      address: data.get("address"),
                      phone: data.get("phone"),
                      currency: "LKR",
                      receiptNote: data.get("receiptNote"),
                      taxRate: Number(data.get("taxRate")),
                    });
                    if (result) notify("Store settings saved");
                  }}
                  key={mode}
                >
                  <Field label="Store name">
                    <input
                      name="name"
                      defaultValue={state.settings.name}
                      required
                    />
                  </Field>
                  <Field label="Address">
                    <textarea
                      name="address"
                      defaultValue={state.settings.address}
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="Phone">
                      <input name="phone" defaultValue={state.settings.phone} />
                    </Field>
                    <Field label="Currency">
                      <input value="LKR — Sri Lankan rupees" readOnly />
                    </Field>
                    <Field label="Tax rate (%)">
                      <input
                        name="taxRate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        defaultValue={state.settings.taxRate}
                      />
                    </Field>
                  </div>
                  <p className="muted">
                    Tax is added after discount. Set the rate that applies to
                    your business.
                  </p>
                  <Field label="Receipt footer">
                    <input
                      name="receiptNote"
                      defaultValue={state.settings.receiptNote}
                    />
                  </Field>
                  <button className="primary" disabled={busy}>
                    <Check size={17} />
                    Save settings
                  </button>
                </form>
              </section>
              <div>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Your workspace</h2>
                      <p>
                        {mode === "live"
                          ? "Supabase cloud storage"
                          : "Browser sample storage"}
                      </p>
                    </div>
                  </div>
                  <div className="settings-form">
                    <p>
                      Live records belong to the signed-in owner account. Sample
                      records stay on this browser and are never uploaded
                      automatically.
                    </p>
                    <button
                      className="primary wide"
                      onClick={() => setModal("account")}
                    >
                      <LogIn size={17} />
                      Manage account
                    </button>
                    <button
                      className="button wide"
                      onClick={() =>
                        download(
                          `ayngaran-${mode}-backup-${today}.json`,
                          JSON.stringify(
                            {
                              exportedAt: new Date().toISOString(),
                              mode,
                              state,
                            },
                            null,
                            2,
                          ),
                        )
                      }
                    >
                      <Download size={17} />
                      Export full backup
                    </button>
                  </div>
                </section>
                <BackupPanel
                  state={state}
                  mode={mode}
                  onSeed={() => openForm("seed", { confirm: "" })}
                />
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Counter shortcuts</h2>
                  </div>
                  <div className="shortcut-list">
                    <span>
                      Find products <kbd>F2</kbd>
                    </span>
                    <span>
                      Open barcode scanner <kbd>F4</kbd>
                    </span>
                    <span>
                      Add exact match <kbd>Enter</kbd>
                    </span>
                    <span>
                      Close dialog <kbd>Esc</kbd>
                    </span>
                  </div>
                </section>
              </div>
            </div>
          )}
          <footer className="page-footer">
            <span>
              <Flower2 size={13} /> Thoughtfully made for your everyday
              business.
            </span>
            <span>
              Ayngaran Stores <span className="footer-dot">•</span> LKR
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {modal && (
        <Modal
          title={
            (
              {
                seed: "Load dummy data",
                price: "Update product price",
                product: form.id ? "Edit product" : "Add a new product",
                customer: form.id ? "Edit customer" : "Add a customer",
                supplier: form.id ? "Edit supplier" : "Add a supplier",
                scanner: "Scan a barcode",
                productScanner: "Scan product barcode",
                checkout: "Complete your sale",
                calculator: "Quick calculator",
                held: "Held bills",
                clear: "Clear current bill?",
                receipt: "Sale receipt",
                ledger: "Account details",
                payment: "Record a payment",
                adjust: "Adjust stock",
                purchase: "Record a purchase",
                settings: "Store settings",
                account: "Your Ayngaran workspace",
                void: "Void this sale?",
              } as any
            )[modal] || modal
          }
          close={close}
          wide={
            modal === "product" || modal === "ledger" || modal === "purchase"
          }
        >
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          {modal === "seed" && (
            <form onSubmit={submitForm}>
              <p>
                Load 16 dummy products, customers with villages, suppliers and
                sample transactions. This works only on an empty store and never
                replaces existing records.
              </p>
              <Field label="Type LOAD DUMMY DATA to confirm">
                <input
                  value={form.confirm}
                  onChange={(e) => update("confirm", e.target.value)}
                  required
                />
              </Field>
              <button
                className="primary wide"
                disabled={busy || form.confirm !== "LOAD DUMMY DATA"}
              >
                Load dummy data
              </button>
            </form>
          )}
          {modal === "price" && (
            <form onSubmit={submitForm}>
              <h3>
                {state.products.find((p: any) => p.id === form.productId)?.name}
              </h3>
              <p>
                New bills use the updated price. Existing bills and their
                profits keep the original price and cost.
              </p>
              <Field label="New selling price (LKR)">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.price}
                  required
                  onChange={(e) => update("price", Number(e.target.value))}
                />
              </Field>
              <Field label="New purchase cost (LKR)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  required
                  onChange={(e) => update("cost", Number(e.target.value))}
                />
              </Field>
              <Field label="Reason for price update">
                <input
                  value={form.reason}
                  required
                  onChange={(e) => update("reason", e.target.value)}
                />
              </Field>
              <div className="payment-balance">
                <span>Gross margin per unit</span>
                <strong>Rs. {fmt(form.price - form.cost)}</strong>
              </div>
              <button className="primary wide" disabled={busy}>
                Save price update
              </button>
            </form>
          )}
          {modal === "scanner" && <Scanner onScan={scan} />}
          {modal === "productScanner" && (
            <Scanner
              onScan={(value) => {
                update("barcode", value);
                setModal("product");
              }}
            />
          )}
          {modal === "product" && (
            <form onSubmit={submitForm}>
              <div className="form-section-title">
                Product information{" "}
                <span>Make it easy to find at the counter</span>
              </div>
              <div className="form-grid">
                <Field label="Product name *">
                  <input
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    required
                    placeholder="e.g. Samba Rice"
                  />
                </Field>
                <Field label="Tamil name (optional)">
                  <input
                    value={form.tamil}
                    onChange={(e) => update("tamil", e.target.value)}
                    placeholder="அரிசி"
                  />
                </Field>
                <Field label="Category">
                  <select
                    value={form.category}
                    onChange={(e) => update("category", e.target.value)}
                  >
                    {categories.slice(1).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Unit">
                  <select
                    value={form.unit}
                    onChange={(e) => update("unit", e.target.value)}
                  >
                    {[
                      "kg",
                      "g",
                      "each",
                      "pack",
                      "bottle",
                      "carton",
                      "litre",
                      "box",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="SKU">
                  <input
                    value={form.sku}
                    onChange={(e) => update("sku", e.target.value)}
                    placeholder="AYS-001"
                  />
                </Field>
                <Field label="Barcode">
                  <input
                    value={form.barcode}
                    onChange={(e) => update("barcode", e.target.value)}
                    placeholder="Scan with a USB scanner or type"
                  />
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setModal("productScanner")}
                  >
                    <ScanLine size={15} />
                    Scan with camera
                  </button>
                </Field>
              </div>
              <div className="form-section-title">
                Pricing & inventory <span>All amounts in LKR</span>
              </div>
              <div className="form-grid">
                {[
                  ["price", "Selling price *"],
                  ["cost", "Purchase cost *"],
                  [
                    "stock",
                    form.id
                      ? "Current stock (use Adjust stock)"
                      : "Opening stock *",
                  ],
                  ["reorder", "Low-stock alert at"],
                ].map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input
                      type="number"
                      min={key === "price" ? "0.01" : "0"}
                      step="0.01"
                      value={form[key]}
                      readOnly={key === "stock" && !!form.id}
                      onChange={(e) => update(key, Number(e.target.value))}
                      required
                    />
                  </Field>
                ))}
              </div>
              <Field label="Product image (optional)">
                <div className="upload-box">
                  {form.image ? (
                    <>
                      <img src={form.image} alt="Product preview" />
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => update("image", "")}
                      >
                        Remove image
                      </button>
                    </>
                  ) : (
                    <ImagePlus size={28} />
                  )}
                  <span>Choose a photo · automatically optimized to WebP</span>
                  <input
                    aria-label="Product image"
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        try {
                          update("image", await webp(file));
                        } catch (err: any) {
                          setError(err.message);
                        }
                    }}
                  />
                </div>
              </Field>
              <div className="form-actions">
                <button type="button" className="button" onClick={close}>
                  Cancel
                </button>
                <button className="primary" disabled={busy}>
                  <Check size={17} />
                  {busy ? "Saving…" : "Save product"}
                </button>
              </div>
            </form>
          )}
          {(modal === "customer" || modal === "supplier") && (
            <form onSubmit={submitForm}>
              <Field label="Name *">
                <input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </Field>
              <Field label="Address">
                <textarea
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                />
              </Field>
              {modal === "customer" && (
                <Field label="Village (optional)">
                  <input
                    list="village-options"
                    value={form.village || ""}
                    onChange={(e) => update("village", e.target.value)}
                    placeholder="Choose or type a village"
                  />
                  <datalist id="village-options">
                    {villages.map((v: any) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </Field>
              )}
              <Field label="Opening balance (LKR)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.openingBalance}
                  readOnly={!!form.id}
                  onChange={(e) =>
                    update("openingBalance", Number(e.target.value))
                  }
                />
              </Field>
              {modal === "customer" && (
                <Field label="Credit limit (LKR)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.creditLimit}
                    onChange={(e) =>
                      update("creditLimit", Number(e.target.value))
                    }
                  />
                </Field>
              )}
              <div className="form-actions">
                <button type="button" className="button" onClick={close}>
                  Cancel
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? "Saving…" : "Save " + modal}
                </button>
              </div>
            </form>
          )}
          {modal === "checkout" && (
            <div>
              <div className="checkout-amount">
                <span>Total payable</span>
                <strong>
                  <small>LKR</small> {fmt(total.total)}
                </strong>
                <p>
                  {cart.length} items ·{" "}
                  {selectedCustomer?.name || "Walk-in customer"}
                </p>
              </div>
              <div className="payment-methods">
                {[
                  ["cash", Banknote, "Cash"],
                  ["card", CreditCard, "Card"],
                  ["credit", Wallet, "Credit"],
                ].map(([id, Icon, label]: any) => (
                  <button
                    key={id}
                    className={method === id ? "selected" : ""}
                    onClick={() => {
                      setMethod(id);
                      setTendered(id === "credit" ? "0" : String(total.total));
                    }}
                  >
                    <Icon size={22} />
                    {label}
                  </button>
                ))}
              </div>
              {(method === "credit" || checkoutCredit > 0) && !customerId && (
                <div className="alert">
                  Select a customer below to save the unpaid balance as credit.
                </div>
              )}
              {(method === "credit" || checkoutCredit > 0) && (
                <div className="customer-select">
                  <Users size={18} />
                  <CustomerPicker
                    customers={state.customers}
                    value={customerId}
                    onChange={setCustomerId}
                  />
                </div>
              )}
              <Field
                label={
                  method === "cash"
                    ? "Cash received (LKR)"
                    : method === "credit"
                      ? "Paid now (LKR)"
                      : "Card payment recorded (LKR)"
                }
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tendered}
                  readOnly={method === "card"}
                  onChange={(e) => setTendered(e.target.value)}
                />
              </Field>
              {method === "cash" && (
                <>
                  <div className="cash-options">
                    {[500, 1000, 2000, 5000]
                      .filter((n) => n >= total.total)
                      .map((n) => (
                        <button
                          key={n}
                          className="button"
                          onClick={() => setTendered(String(n))}
                        >
                          {n}
                        </button>
                      ))}
                  </div>
                  <div className="payment-balance">
                    <span>Change to return</span>
                    <strong>
                      Rs. {fmt(Math.max(0, Number(tendered) - total.total))}
                    </strong>
                  </div>
                </>
              )}
              {(method === "credit" || checkoutCredit > 0) && (
                <div className="payment-balance">
                  <span>Added to customer credit</span>
                  <strong>Rs. {fmt(checkoutCredit)}</strong>
                </div>
              )}
              {checkoutCredit > 0 && selectedCustomer && (
                <p className={creditLimitExceeded ? "alert" : "muted"}>
                  Customer balance after this bill: Rs. {fmt(checkoutBalance)}.
                  {creditLimitExceeded
                    ? " Customer credit limit exceeded."
                    : " The unpaid amount is saved automatically when you complete the sale."}
                </p>
              )}
              {method === "card" && (
                <p className="muted">
                  Complete the payment on your card terminal first. This records
                  the payment; it does not charge a card.
                </p>
              )}
              <button
                className="primary wide large"
                disabled={
                  busy ||
                  (method === "credit" && !customerId) ||
                  (checkoutCredit > 0 && !customerId) ||
                  !!creditLimitExceeded ||
                  tendered.trim() === "" ||
                  !Number.isFinite(Number(tendered)) ||
                  Number(tendered) < 0 ||
                  (method === "credit" && Number(tendered) > total.total)
                }
                onClick={checkout}
              >
                <CheckCircle2 size={19} />
                {busy ? "Saving bill…" : "Complete sale"}
              </button>
              <p className="secure-note">
                Stock and account balances update together when saved.
              </p>
            </div>
          )}
          {modal === "calculator" && <QuickCalculator />}
          {modal === "held" && (
            <div>
              {state.held.map((h: any) => (
                <div className="held-row" key={h.id}>
                  <div>
                    <strong>{h.label}</strong>
                    <small>{dateLabel(h.date)}</small>
                  </div>
                  <button
                    className="button"
                    disabled={cart.length > 0 || busy}
                    onClick={() => {
                      setCart(h.items);
                      setCustomerId(h.customerId || "");
                      setDiscount(h.discount);
                      setHeldId(h.id);
                      setModal("");
                    }}
                  >
                    Resume
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Delete held bill"
                    disabled={busy}
                    onClick={() => act("deleteHold", { id: h.id })}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
              {!state.held.length && (
                <Empty
                  title="No bills on hold"
                  detail="Hold a bill to serve another customer and come back later."
                />
              )}
              {!!cart.length && (
                <p className="muted">
                  Finish or clear the current bill before resuming another.
                </p>
              )}
            </div>
          )}
          {modal === "clear" && (
            <div>
              <p>
                Remove all items from the current bill? Your saved sales will be
                kept.
              </p>
              <div className="form-actions">
                <button className="button" onClick={close}>
                  Keep bill
                </button>
                <button
                  className="primary"
                  onClick={() => {
                    setCart([]);
                    setCustomerId("");
                    setDiscount(0);
                    setHeldId(null);
                    close();
                  }}
                >
                  Clear bill
                </button>
              </div>
            </div>
          )}
          {modal === "receipt" && receipt && (
            <>
              <Receipt
                sale={receipt}
                settings={state.settings}
                demo={mode === "demo"}
              />
              <div className="payment-balance">
                <span>Gross profit on this sale</span>
                <strong>Rs. {fmt(grossProfit(receipt))}</strong>
              </div>
              <p className="muted">
                After discount, before tax and overheads. This is not printed on
                the customer receipt.
              </p>
              <div className="form-actions">
                <button className="button" onClick={close}>
                  Done
                </button>
                <button className="primary" onClick={() => window.print()}>
                  <Printer size={17} />
                  Print receipt
                </button>
              </div>
              {!receipt.void && (
                <button
                  className="text-button danger"
                  onClick={() =>
                    openForm("void", { id: receipt.id, reason: "" })
                  }
                >
                  Void sale & restore stock
                </button>
              )}
            </>
          )}
          {modal === "void" && (
            <form onSubmit={submitForm}>
              <p>
                This voids the entire sale, restores stock and reverses its
                credit. Return any collected cash/card payment separately.
              </p>
              <Field label="Reason *">
                <textarea
                  value={form.reason}
                  required
                  onChange={(e) => update("reason", e.target.value)}
                />
              </Field>
              <button className="primary wide" disabled={busy}>
                Confirm void
              </button>
            </form>
          )}
          {modal === "ledger" && (
            <div>
              <div className="ledger-header">
                <span className="person-avatar large">{form.name[0]}</span>
                <div>
                  <h2>{form.name}</h2>
                  <p>
                    {form.phone} · {form.address}
                  </p>
                </div>
              </div>
              <div className="balance-box">
                <span>Outstanding balance</span>
                <strong>
                  Rs.{" "}
                  {fmt(
                    form.kind === "customer"
                      ? customerBalance(state, form.id)
                      : supplierBalance(state, form.id),
                  )}
                </strong>
              </div>
              <div className="form-actions">
                <button
                  className="button"
                  onClick={() => openForm(form.kind, { ...form })}
                >
                  Edit details
                </button>
                <button
                  className="primary"
                  onClick={() =>
                    openForm("payment", {
                      [form.kind + "Id"]: form.id,
                      amount: 0,
                      note: "",
                    })
                  }
                >
                  <Wallet size={17} />
                  Record {form.kind === "customer" ? "collection" : "payment"}
                </button>
              </div>
              {form.kind === "customer" && (
                <CustomerBills
                  sales={state.sales}
                  customer={form}
                  onReceipt={(sale) => {
                    setReceipt(sale);
                    setModal("receipt");
                  }}
                />
              )}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date / reference</th>
                      <th>Description</th>
                      <th>Debit</th>
                      <th>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Opening</td>
                      <td>Opening balance</td>
                      <td>{fmt(form.openingBalance)}</td>
                      <td>—</td>
                    </tr>
                    {(form.kind === "customer"
                      ? state.sales.filter((s: any) => s.customerId === form.id)
                      : state.purchases.filter(
                          (p: any) => p.supplierId === form.id,
                        )
                    ).map((s: any) => (
                      <tr key={s.id}>
                        <td>
                          {s.number}
                          <small>{dateLabel(s.date)}</small>
                        </td>
                        <td>
                          {s.void
                            ? "Voided bill"
                            : form.kind === "customer"
                              ? "Sale"
                              : "Purchase"}
                        </td>
                        <td>{s.void ? "—" : fmt(s.total)}</td>
                        <td>{s.void ? "—" : fmt(s.paid)}</td>
                      </tr>
                    ))}
                    {state.payments
                      .filter((p: any) => p[form.kind + "Id"] === form.id)
                      .map((p: any) => (
                        <tr key={p.id}>
                          <td>{dateLabel(p.date)}</td>
                          <td>{p.note || "Payment"}</td>
                          <td>—</td>
                          <td>{fmt(p.amount)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {modal === "payment" && (
            <form onSubmit={submitForm}>
              <p>
                Record a payment for{" "}
                {
                  (form.customerId ? state.customers : state.suppliers).find(
                    (c: any) => c.id === (form.customerId || form.supplierId),
                  )?.name
                }
                .
              </p>
              <Field label="Amount (LKR) *">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount || ""}
                  required
                  onChange={(e) => update("amount", Number(e.target.value))}
                />
              </Field>
              <Field label="Note / payment reference">
                <input
                  value={form.note}
                  onChange={(e) => update("note", e.target.value)}
                />
              </Field>
              <button className="primary wide" disabled={busy}>
                Save payment
              </button>
            </form>
          )}
          {modal === "adjust" && (
            <form onSubmit={submitForm}>
              <Field label="Product *">
                <select
                  value={form.productId}
                  required
                  onChange={(e) => update("productId", e.target.value)}
                >
                  <option value="">Select product</option>
                  {state.products.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.stock} {p.unit}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quantity change *">
                <input
                  type="number"
                  step="0.01"
                  value={form.quantity || ""}
                  onChange={(e) => update("quantity", Number(e.target.value))}
                  required
                  placeholder="e.g. 10 or -2"
                />
              </Field>
              <p className="muted">
                Positive adds stock. Negative removes stock.
              </p>
              <Field label="Reason *">
                <textarea
                  value={form.reason}
                  onChange={(e) => update("reason", e.target.value)}
                  required
                  placeholder="Stock count correction, damage…"
                />
              </Field>
              <button className="primary wide" disabled={busy}>
                Save stock adjustment
              </button>
            </form>
          )}
          {modal === "purchase" && (
            <PurchaseForm
              products={state.products}
              suppliers={state.suppliers}
              busy={busy}
              onSave={async (payload) => {
                const result = await act("purchase", payload);
                if (result) close();
              }}
            />
          )}
          {modal === "account" && (
            <div>
              {user ? (
                <>
                  <div className="account-status">
                    <CheckCircle2 size={30} />
                    <h3>Signed in</h3>
                    <p>{user.email}</p>
                  </div>
                  <button
                    className="primary wide"
                    disabled={busy}
                    onClick={switchLive}
                  >
                    <RefreshCw size={17} />
                    {busy ? "Loading…" : "Open live store"}
                  </button>
                  <button
                    className="button wide"
                    onClick={async () => {
                      await getSupabase()?.auth.signOut();
                      setUser(null);
                      setMode("demo");
                      localStorage.setItem("ayngaran-mode", "demo");
                      try {
                        const saved = localStorage.getItem("ayngaran-demo-v1");
                        setState(saved ? JSON.parse(saved).state : seedState());
                      } catch {
                        setState(seedState());
                      }
                      setCart([]);
                      setCustomerId("");
                      setDiscount(0);
                      setHeldId(null);
                      close();
                    }}
                  >
                    <LogOut size={17} />
                    Sign out & return to sample
                  </button>
                </>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const sb = getSupabase();
                    if (!sb) {
                      setError("Supabase is not configured. See .env.example.");
                      return;
                    }
                    setBusy(true);
                    setError("");
                    const fd = new FormData(e.currentTarget);
                    const credentials = {
                      email: String(fd.get("email")),
                      password: String(fd.get("password")),
                    };
                    try {
                      const result =
                        authMode === "signin"
                          ? await sb.auth.signInWithPassword(credentials)
                          : await sb.auth.signUp(credentials);
                      if (result.error) throw result.error;
                      if (result.data.session) {
                        setUser(result.data.user);
                        await switchLive();
                      } else
                        notify(
                          "Check your email to confirm your account, then sign in.",
                        );
                    } catch (e: any) {
                      setError(authErrorMessage(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <div className="auth-intro">
                    <span className="brand-mark">
                      <GaneshMark />
                    </span>
                    <h3>
                      {authMode === "signin"
                        ? "Welcome to your store"
                        : "Create your owner account"}
                    </h3>
                    <p>
                      Sign in to keep your products, bills and accounts securely
                      in Supabase.
                    </p>
                  </div>
                  <Field label="Email">
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                    />
                  </Field>
                  <Field label="Password">
                    <input
                      name="password"
                      type="password"
                      minLength={8}
                      autoComplete={
                        authMode === "signin"
                          ? "current-password"
                          : "new-password"
                      }
                      required
                    />
                  </Field>
                  <button className="primary wide" disabled={busy}>
                    {busy
                      ? "Please wait…"
                      : authMode === "signin"
                        ? "Sign in to live store"
                        : "Create account"}
                  </button>
                  <button
                    type="button"
                    className="text-button centered"
                    onClick={() =>
                      setAuthMode(authMode === "signin" ? "signup" : "signin")
                    }
                  >
                    {authMode === "signin"
                      ? "New here? Create an account"
                      : "Already have an account? Sign in"}
                  </button>
                </form>
              )}
              <p className="secure-note">
                Live accounts start empty. Sample transactions are never mixed
                with live records.
              </p>
            </div>
          )}
        </Modal>
      )}
      {page === "Point of sale" && (
        <button
          className="mobile-bill-link"
          onClick={() =>
            document
              .querySelector(".bill-panel")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <ShoppingBasket size={18} />
          View bill · {cart.length} items{" "}
          <strong>Rs. {fmt(total.total)}</strong>
        </button>
      )}
      <div className="print-only">
        {receipt && (
          <Receipt
            sale={receipt}
            settings={state.settings}
            demo={mode === "demo"}
          />
        )}
      </div>
    </div>
  );
  function salesTable(sales: any[]) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Bill number</th>
              <th>Date & time</th>
              <th>Customer</th>
              <th>Payment</th>
              <th>Total</th>
              <th>Gross profit</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.number}</strong>
                </td>
                <td>{dateLabel(s.date)}</td>
                <td>{s.customerName}</td>
                <td className="capitalize">{s.method}</td>
                <td>
                  <strong>Rs. {fmt(s.total)}</strong>
                </td>
                <td className={grossProfit(s) < 0 ? "negative" : "positive"}>
                  Rs. {fmt(grossProfit(s))}
                </td>
                <td>
                  <span className={"status " + (s.void ? "amber" : "green")}>
                    {s.void ? "Voided" : "Completed"}
                  </span>
                </td>
                <td>
                  <button
                    className="icon-button"
                    title="View receipt"
                    onClick={() => {
                      setReceipt(s);
                      setModal("receipt");
                    }}
                  >
                    <ReceiptText size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sales.length && (
          <Empty
            title="No sales to show yet"
            detail="Your completed bills will appear here. Make your first sale at the counter."
          />
        )}
      </div>
    );
  }
}
function Stat({
  title,
  value,
  icon: Icon,
  note,
}: {
  title: string;
  value: any;
  icon: any;
  note: string;
}) {
  return (
    <div className="stat">
      <div>
        <span>{title}</span>
        <span className="stat-icon">
          <Icon size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function SalesChart({ sales }: { sales: any[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return d;
  });
  const values = days.map((d) =>
    sales
      .filter((s) => !s.void && day(s.date) === day(d.toISOString()))
      .reduce((a, s) => a + s.total, 0),
  );
  const max = Math.max(1000, ...values);
  return (
    <div className="sales-chart">
      <div className="chart-scale">
        <span>{fmt(max)}</span>
        <span>{fmt(max / 2)}</span>
        <span>0</span>
      </div>
      <div className="chart-bars">
        {days.map((d, i) => (
          <div key={i} className="chart-column">
            <div className="bar-track">
              <div
                className={"bar " + (i === 6 ? "last" : "")}
                style={{ height: Math.max(1, (values[i] / max) * 100) + "%" }}
                title={"Rs. " + fmt(values[i])}
              >
                <span>{values[i] > 0 ? fmt(values[i]) : ""}</span>
              </div>
            </div>
            <small>
              {d.toLocaleDateString("en-GB", {
                weekday: "short",
                timeZone: "Asia/Colombo",
              })}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}
function Receipt({
  sale,
  settings,
  demo,
}: {
  sale: any;
  settings: any;
  demo: boolean;
}) {
  settings = sale.seller || settings;
  return (
    <div className="receipt">
      <GaneshMark />
      <h2>{settings.name}</h2>
      <p>
        {settings.address}
        <br />
        {settings.phone}
      </p>
      {demo && <strong className="sample-receipt">SAMPLE RECEIPT</strong>}
      {sale.void && <strong className="sample-receipt">VOIDED</strong>}
      <div className="receipt-meta">
        <span>{sale.number}</span>
        <span>{dateLabel(sale.date)}</span>
      </div>
      <p className="receipt-customer">
        Customer: {sale.customerName}
        {sale.customerVillage && <> · {sale.customerVillage}</>}
        {sale.customerCode && (
          <>
            <br />
            {sale.customerCode}
          </>
        )}
      </p>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>LKR</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((l: any) => (
            <tr key={l.productId}>
              <td>
                <span>
                  {l.name}
                  {l.tamil && (
                    <>
                      {" "}
                      / <span lang="ta">{l.tamil}</span>
                    </>
                  )}
                </span>
                <small>
                  {fmt(l.price)} / {l.unit}
                </small>
              </td>
              <td>{l.quantity}</td>
              <td>{fmt(l.quantity * l.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="receipt-totals">
        <div>
          <span>Subtotal</span>
          <span>{fmt(sale.subtotal)}</span>
        </div>
        <div>
          <span>Discount</span>
          <span>−{fmt(sale.discount)}</span>
        </div>
        <div>
          <span>Tax</span>
          <span>{fmt(sale.tax)}</span>
        </div>
        <div className="receipt-total">
          <strong>TOTAL LKR</strong>
          <strong>{fmt(sale.total)}</strong>
        </div>
        <div>
          <span>Paid · {sale.method}</span>
          <span>{fmt(sale.paid)}</span>
        </div>
        {sale.method === "cash" && (
          <div>
            <span>Change</span>
            <span>{fmt(sale.change)}</span>
          </div>
        )}
        {sale.total > sale.paid && (
          <div>
            <strong>Credit balance on this bill</strong>
            <strong>{fmt(sale.total - sale.paid)}</strong>
          </div>
        )}
      </div>
      <p>{settings.receiptNote}</p>
      <small className="receipt-end">வாழ்க வளமுடன் · Ayngaran Stores</small>
    </div>
  );
}

function QuantityInput({
  name,
  value,
  onCommit,
}: {
  name: string;
  value: number;
  onCommit: (quantity: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      aria-label={"Quantity of " + name}
      type="number"
      min="0.01"
      step="0.01"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const q = Number(draft);
        if (Number.isFinite(q) && q > 0) onCommit(q);
        setDraft(String(value));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
