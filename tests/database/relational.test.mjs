import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { grossProfit } from "../../lib/reporting.mjs";
import {
  emptyState,
  seedState,
  applyAction,
  customerBalance,
  supplierBalance,
} from "../../lib/domain.mjs";
import {
  relationalRows,
  relationalChanges,
} from "../../server/relational-model.mjs";
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20261012202125_normalize_store_records.sql",
    import.meta.url,
  ),
  "utf8",
);
async function setup(state = seedState()) {
  const db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`,
  );
  await db.exec(
    readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8"),
  );
  await db.query("insert into auth.users values ($1),($2)", [owner, other]);
  await db.query(
    "insert into public.ayngaran_stores(owner_id,state) values ($1,$2),($3,$4)",
    [owner, JSON.stringify(state), other, JSON.stringify(emptyState())],
  );
  return db;
}
async function signIn(db, id = owner) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function load(db) {
  return (
    await db.query("select public.ayngaran_load_v2($1) as value", [
      JSON.stringify(emptyState()),
    ])
  ).rows[0].value;
}
async function commit(db, current, type, payload, id = crypto.randomUUID()) {
  const next = applyAction(current.state, { type, payload });
  return (
    await db.query("select public.ayngaran_commit_v2($1,$2,$3,$4) as value", [
      current.revision,
      id,
      JSON.stringify(relationalChanges(current.state, next.state)),
      JSON.stringify(next.result),
    ])
  ).rows[0].value;
}
test("normalized migration retains legacy records and workflows, isolates owners and rolls back invalid saves", async () => {
  let initial = seedState();
  initial.settings.customSnapshot = { value: null };
  initial = applyAction(initial, {
    type: "checkout",
    payload: {
      items: [{ productId: initial.products[0].id, quantity: 0.5 }],
      customerId: initial.customers[0].id,
      method: "cash",
      tendered: 50,
      discount: 0,
    },
  }).state;
  initial = applyAction(initial, {
    type: "purchase",
    payload: {
      supplierId: initial.suppliers[0].id,
      items: [
        {
          productId: initial.products[0].id,
          quantity: 2,
          cost: 200,
          sellingPrice: 250,
        },
        {
          productId: initial.products[1].id,
          quantity: 1,
          cost: 180,
          sellingPrice: 225,
        },
      ],
      paid: 100,
    },
  }).state;
  const db = await setup(initial);
  try {
    await db.exec(migration);
    const insecure = await db.query(
      "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'ayngaran_%' and not c.relrowsecurity",
    );
    assert.equal(insecure.rows.length, 0);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ayngaran_private' and p.prosecdef",
        )
      ).rows[0].n,
      0,
    );
    // Rerunning must not overwrite new relational data with the archived snapshot.
    await db.exec(migration);
    await signIn(db);
    let current = await load(db);
    assert.equal(current.storageVersion, 2);
    assert.deepEqual(current.state, initial);
    assert.equal(
      customerBalance(current.state, initial.customers[0].id),
      customerBalance(initial, initial.customers[0].id),
    );
    const legacy = (
      await db.query(
        "select state from public.ayngaran_stores where owner_id=$1",
        [owner],
      )
    ).rows[0].state;
    assert.deepEqual(legacy, initial);
    const requestId = crypto.randomUUID();
    const salePayload = {
      items: [{ productId: initial.products[0].id, quantity: 0.25 }],
      customerId: initial.customers[0].id,
      method: "cash",
      tendered: 10,
      discount: 0,
    };
    const sold = await commit(db, current, "checkout", salePayload, requestId);
    assert.equal(sold.result.paid, 10);
    assert.equal(
      sold.state.products[0].stock,
      current.state.products[0].stock - 0.25,
    );
    const duplicate = await commit(
      db,
      current,
      "checkout",
      salePayload,
      requestId,
    );
    assert.deepEqual(duplicate, sold);
    const conflict = await commit(db, current, "checkout", salePayload);
    assert.deepEqual(conflict, { conflict: true });
    current = sold;
    const paid = await commit(db, current, "payment", {
      customerId: initial.customers[0].id,
      amount: 10,
    });
    assert.equal(
      customerBalance(paid.state, initial.customers[0].id),
      customerBalance(current.state, initial.customers[0].id) - 10,
    );
    current = await commit(db, paid, "hold", {
      items: [{ productId: initial.products[0].id, quantity: 0.5 }],
      customerId: null,
      discount: 0,
      label: "Counter draft",
    });
    assert.equal(current.state.held.length, 1);
    current = await commit(db, current, "deleteHold", {
      id: current.state.held[0].id,
    });
    assert.equal(current.state.held.length, 0);
    // Constraints fail the entire transaction, including revision/idempotency.
    const invalid = relationalRows(current.state);
    invalid.inventory[0].stock = -1;
    const badId = crypto.randomUUID();
    await assert.rejects(
      db.query("select public.ayngaran_commit_v2($1,$2,$3,null)", [
        current.revision,
        badId,
        JSON.stringify(invalid),
      ]),
      /check constraint/,
    );
    assert.deepEqual(await load(db), {
      state: current.state,
      revision: current.revision,
      storageVersion: 2,
    });
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.ayngaran_requests where request_id=$1",
          [badId],
        )
      ).rows[0].n,
      0,
    );
    await assert.rejects(
      db.query("select public.ayngaran_commit($1,$2,$3,null)", [
        current.revision,
        crypto.randomUUID(),
        JSON.stringify(initial),
      ]),
      /Database upgraded/,
    );
    await signIn(db, other);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.ayngaran_products",
        )
      ).rows[0].n,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into public.ayngaran_inventory(owner_id,id,stock) values ($1,$2,1)",
        [owner, initial.products[0].id],
      ),
      /row-level security/,
    );
    await db.exec("reset role; set role anon");
    await assert.rejects(
      db.query("select * from public.ayngaran_sales"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.ayngaran_load_v2($1)", [
        JSON.stringify(emptyState()),
      ]),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

test("all existing transaction types round-trip through normalized tables without screen-state changes", async () => {
  const db = await setup(emptyState());
  try {
    await db.exec(migration);
    await signIn(db);
    let current = await load(db);
    const run = async (type, payload, seedTemplate) => {
      const changed = applyAction(current.state, {
        type,
        payload,
        seedTemplate,
      });
      const changes = {
        ...relationalChanges(current.state, changed.state),
        _action: type,
      };
      const result = (
        await db.query(
          "select public.ayngaran_commit_v2($1,$2,$3,$4) as value",
          [
            current.revision,
            crypto.randomUUID(),
            JSON.stringify(changes),
            JSON.stringify(changed.result),
          ],
        )
      ).rows[0].value;
      assert.deepEqual(
        result.state,
        changed.state,
        `${type} state changed during storage`,
      );
      current = result;
      return result.result;
    };
    await run("seed", { confirm: "LOAD DUMMY DATA" }, seedState());
    const product = await run("product", {
      name: "Test oil",
      tamil: "எண்ணெய்",
      sku: "TEST-OIL",
      barcode: "001234",
      category: "Oil",
      unit: "litre",
      price: 500,
      cost: 400,
      stock: 10,
      reorder: 2,
      art: "oil",
      image: "data:image/webp;base64,UklGRg==",
    });
    const customer = await run("customer", {
      name: "Buyer",
      phone: "0771234567",
      address: "Test",
      village: "Hopton",
      creditLimit: 10000,
      openingBalance: 0,
    });
    const supplier = await run("supplier", {
      name: "Supplier",
      phone: "",
      address: "Test",
      village: "KR division",
      openingBalance: 0,
    });
    await run("product", { ...product, name: "Updated oil", stock: 999 });
    await run("customer", { ...customer, phone: "0777654321" });
    await run("supplier", { ...supplier, address: "Updated address" });
    await run("price", {
      productId: product.id,
      price: 520,
      cost: 410,
      reason: "Supplier change",
    });
    await run("purchase", {
      supplierId: supplier.id,
      items: [
        { productId: product.id, quantity: 2, cost: 410, sellingPrice: 520 },
      ],
      paid: 100,
      reference: "INV-1",
    });
    await run("payment", {
      supplierId: supplier.id,
      amount: 20,
      note: "Part payment",
    });
    await run("adjust", {
      productId: product.id,
      quantity: -0.25,
      reason: "Damaged",
    });
    await run("hold", {
      items: [{ productId: product.id, quantity: 0.5 }],
      customerId: customer.id,
      discount: 0,
      label: "Held bill",
    });
    const sale = await run("checkout", {
      items: [{ productId: product.id, quantity: 0.5 }],
      customerId: customer.id,
      discount: 0,
      method: "cash",
      tendered: 50,
      heldId: current.state.held[0].id,
    });
    await run("void", { id: sale.id, reason: "Wrong bill" });
    await run("checkout", {
      items: [{ productId: product.id, quantity: 0.25 }],
      customerId: customer.id,
      discount: 0,
      method: "credit",
      tendered: 0,
    });
    await run("payment", {
      customerId: customer.id,
      amount: 30,
      note: "Collected",
    });
    await run("checkout", {
      items: [{ productId: product.id, quantity: 1 }],
      customerId: null,
      discount: 0,
      method: "card",
      tendered: 520,
    });
    await run("settings", {
      ...current.state.settings,
      receiptNote: "நன்றி",
      phone: "0771234567",
    });
    const balance = (
      await db.query(
        "select balance from public.ayngaran_customer_balances where id=$1",
        [customer.id],
      )
    ).rows[0].balance;
    assert.equal(Number(balance), customerBalance(current.state, customer.id));
    const payable = (
      await db.query(
        "select balance from public.ayngaran_supplier_balances where id=$1",
        [supplier.id],
      )
    ).rows[0].balance;
    assert.equal(Number(payable), supplierBalance(current.state, supplier.id));
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.ayngaran_requests where action_type is null",
        )
      ).rows[0].n,
      0,
    );
    const report = (
      await db.query(
        "select sum(gross_profit) as profit, sum(credit_issued) as credit from public.ayngaran_daily_sales",
      )
    ).rows[0];
    assert.equal(
      Number(report.profit),
      current.state.sales.reduce((sum, sale) => sum + grossProfit(sale), 0),
    );
    assert.equal(
      Number(report.credit),
      current.state.sales
        .filter((sale) => !sale.void)
        .reduce((sum, sale) => sum + sale.total - sale.paid, 0),
    );
    const snapshot = current.state;
    await db.exec("reset role");
    await db.exec(migration);
    await signIn(db);
    assert.deepEqual((await load(db)).state, snapshot);
  } finally {
    await db.close();
  }
});

test("legacy single-item purchases, custom fields and old request IDs survive migration", async () => {
  const state = seedState();
  state.customExtension = { enabled: true };
  state.products[0].customNote = "Keep this";
  state.purchases = [
    {
      id: crypto.randomUUID(),
      supplierId: state.suppliers[0].id,
      productId: state.products[0].id,
      quantity: 2,
      cost: 205,
      total: 410,
      paid: 10,
      date: new Date().toISOString(),
      reference: "Old PO",
    },
  ];
  const db = await setup(state);
  try {
    const id = crypto.randomUUID();
    await db.query(
      "insert into public.ayngaran_requests(owner_id,request_id,result) values($1,$2,$3)",
      [owner, id, JSON.stringify({ id: "original-result" })],
    );
    await db.exec(migration);
    await signIn(db);
    const loaded = await load(db);
    assert.deepEqual(loaded.state.customExtension, state.customExtension);
    assert.equal(loaded.state.products[0].customNote, "Keep this");
    assert.equal(
      loaded.state.purchases[0].items[0].name,
      state.products[0].name,
    );
    assert.equal(supplierBalance(loaded.state, state.suppliers[0].id), 400);
    const repeated = (
      await db.query(
        "select public.ayngaran_commit_v2(0,$1,$2,null) as value",
        [id, "{}"],
      )
    ).rows[0].value;
    assert.deepEqual(repeated.result, { id: "original-result" });
  } finally {
    await db.close();
  }
});

test("migration rejects inconsistent legacy data atomically instead of dropping records", async () => {
  const state = seedState();
  state.products[1].barcode = state.products[0].barcode;
  const db = await setup(state);
  try {
    await assert.rejects(db.exec(migration), /duplicate key/);
    await db.exec("rollback");
    assert.equal(
      (await db.query("select to_regclass('public.ayngaran_products') as t"))
        .rows[0].t,
      null,
    );
    assert.deepEqual(
      (
        await db.query(
          "select state from public.ayngaran_stores where owner_id=$1",
          [owner],
        )
      ).rows[0].state,
      state,
    );
  } finally {
    await db.close();
  }
});
