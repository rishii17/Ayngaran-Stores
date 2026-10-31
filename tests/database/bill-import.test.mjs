import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { emptyState, supplierBalance } from "../../lib/domain.mjs";
const sql = readFileSync(
  new URL("../../supabase/imports/cbl-2026-10-21.sql", import.meta.url),
  "utf8",
);
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const configured = (policy = "proportional_chocolate") =>
  sql
    .replace("v_owner uuid := NULL;", `v_owner uuid := '${owner}';`)
    .replace(
      "v_supplier_name text := NULL;",
      "v_supplier_name text := 'Local supplier fixture';",
    )
    .replace("v_paid numeric := NULL;", "v_paid numeric := 1000;")
    .replace(
      "v_payment_method text := NULL;",
      "v_payment_method text := 'bank';",
    )
    .replace(
      "v_discount_policy text := 'proportional_chocolate';",
      `v_discount_policy text := '${policy}';`,
    );
async function setup() {
  const db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;",
  );
  await db.exec(
    readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8"),
  );
  await db.query("insert into auth.users values($1),($2)", [owner, other]);
  await db.query(
    "insert into public.ayngaran_stores(owner_id,state) values($1,$3),($2,$3)",
    [owner, other, JSON.stringify(emptyState())],
  );
  await db.exec(
    readFileSync(
      new URL(
        "../../supabase/migrations/20261012202125_normalize_store_records.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  return db;
}
async function stateFor(db, id) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  return (
    await db.query("select public.ayngaran_load_v2($1) as result", [
      JSON.stringify(emptyState()),
    ])
  ).rows[0].result;
}
test("photographed bill imports exact totals, net purchase costs, free stock and owner-scoped history once", async () => {
  const db = await setup();
  try {
    await db.exec(configured());
    const current = await stateFor(db, owner);
    const s = current.state;
    assert.equal(s.products.length, 62);
    assert.equal(s.products[0].sku, "AYS-111");
    assert.equal(s.products[61].sku, "AYS-172");
    assert.equal(new Set(s.products.map((product) => product.sku)).size, 62);
    assert.equal(s.purchases.length, 1);
    assert.equal(s.movements.length, 62);
    const bill = s.purchases[0];
    assert.equal(bill.total, 88315.95);
    assert.equal(bill.paid, 1000);
    assert.equal(supplierBalance(s, s.suppliers[0].id), 87315.95);
    assert.equal(bill.items.length, 62);
    const review = new ExcelJS.Workbook();
    const sheet = await review.csv.read(
      Readable.from([
        readFileSync(
          new URL(
            "../../data/purchase-bills/cbl-2026-10-21-net-costs.csv",
            import.meta.url,
          ),
          "utf8",
        ),
      ]),
    );
    const headers = sheet.getRow(1).values;
    for (const line of bill.items) {
      const row = sheet.getRow(line.sourceLine + 1);
      assert.equal(
        Number(row.getCell(headers.indexOf("line")).value),
        line.sourceLine,
      );
      assert.equal(
        Number(row.getCell(headers.indexOf("final_unit_purchase_cost")).value),
        line.cost,
      );
      assert.equal(
        Number(row.getCell(headers.indexOf("net_line_total")).value),
        line.total,
      );
      assert.equal(
        Number(row.getCell(headers.indexOf("allocated_extra_discount")).value),
        line.allocatedInvoiceDiscount,
      );
    }

    const sum = (key) =>
      Math.round(
        bill.items.reduce((total, item) => total + item[key], 0) * 100,
      ) / 100;
    assert.equal(sum("total"), 88315.95);
    assert.equal(sum("allocatedInvoiceDiscount"), 1795.05);
    assert.equal(sum("invoiceGrossLine"), 90111);
    const bubbles = s.products.find((p) => p.name === "Bubbles 30g");
    assert.equal(bubbles.stock, 26);
    assert.equal(bubbles.price, 100);
    assert.equal(bubbles.discountValue, 0); // Supplier discounts are not customer discounts.
    assert.equal(
      bill.items.find((line) => line.productId === bubbles.id).freeQuantity,
      2,
    );
    const first = bill.items.find((line) => line.sourceLine === 1);
    assert.ok(first.cost < 45);
    const cake = bill.items.find((line) => line.sourceLine === 56);
    assert.equal(cake.cost, 382.5);
    assert.equal(cake.allocatedInvoiceDiscount, 0);
    assert.ok(
      bill.items.every(
        (line) =>
          Math.abs(
            line.total -
              (Math.round(line.cost * line.quantity * 100) / 100 +
                line.costRoundingAdjustment),
          ) < 0.000001,
      ),
    );
    const others = await stateFor(db, other);
    assert.equal(others.state.products.length, 0);
    await db.exec(configured());
    assert.deepEqual(await stateFor(db, owner), current);
    const sqlBalance = await db.query(
      "select balance from public.ayngaran_supplier_balances where owner_id=$1",
      [owner],
    );
    assert.equal(Number(sqlBalance.rows[0].balance), 87315.95);
  } finally {
    await db.close();
  }
});
test("missing business inputs or a non-reconciling percentage never write partial stock or purchases", async () => {
  const db = await setup();
  try {
    for (const script of [
      sql,
      configured("UNCONFIRMED"),
      configured("confirmed_percentage")
        .replace(
          "v_actual_percentage numeric := NULL;",
          "v_actual_percentage numeric := 2.5;",
        )
        .replace(
          "v_discount_lines integer[] := NULL;",
          "v_discount_lines integer[] := ARRAY[1,2];",
        ),
    ]) {
      await assert.rejects(db.exec(script));
      await db.exec("rollback");
      const result = await stateFor(db, owner);
      assert.equal(result.state.products.length, 0);
      assert.equal(result.state.purchases.length, 0);
      assert.equal(result.state.suppliers.length, 0);
      assert.equal(result.revision, 0);
    }
  } finally {
    await db.close();
  }
});

test("confirmed percentage mode must reproduce the discount exactly", async () => {
  const db = await setup();
  try {
    const eligible = [...Array.from({ length: 49 }, (_, i) => i + 1), 62];
    // Local arithmetic fixture only, not an assertion about the supplier's actual offer.
    const script = configured("confirmed_percentage")
      .replace(
        "v_actual_percentage numeric := NULL;",
        "v_actual_percentage numeric := 1795.05*100/49617;",
      )
      .replace(
        "v_discount_lines integer[] := NULL;",
        `v_discount_lines integer[] := ARRAY[${eligible.join(",")}];`,
      );
    await db.exec(script);
    const { state } = await stateFor(db, owner);
    assert.equal(state.purchases[0].total, 88315.95);
    assert.equal(state.purchases[0].discountPolicy, "confirmed_percentage");
  } finally {
    await db.close();
  }
});
test("existing product collisions roll back all new supplier, stock and purchase writes", async () => {
  const db = await setup();
  try {
    await db.query(
      "insert into public.ayngaran_products(owner_id,id,name,price,cost,active) values($1,'existing','Choco-La Milk 20g SACMI',50,40,true)",
      [owner],
    );
    await db.query(
      "insert into public.ayngaran_inventory(owner_id,id,stock) values($1,'existing',7)",
      [owner],
    );
    await assert.rejects(db.exec(configured()), /already exists/);
    await db.exec("rollback");
    const { state, revision } = await stateFor(db, owner);
    assert.equal(state.products.length, 1);
    assert.equal(state.products[0].stock, 7);
    assert.equal(state.suppliers.length, 0);
    assert.equal(state.purchases.length, 0);
    assert.equal(revision, 0);
  } finally {
    await db.close();
  }
});

test("SKU numbering follows AYS-110 without changing existing stock and rejects occupied target SKUs", async () => {
  const db = await setup();
  try {
    await db.query(
      "insert into public.ayngaran_products(owner_id,id,name,sku,price,cost,active) values($1,'old-110','Existing product','AYS-110',50,40,true)",
      [owner],
    );
    await db.query(
      "insert into public.ayngaran_inventory(owner_id,id,stock) values($1,'old-110',9)",
      [owner],
    );
    await db.exec(configured());
    const current = await stateFor(db, owner);
    assert.equal(current.state.products.length, 63);
    assert.equal(
      current.state.products.find((p) => p.sku === "AYS-110").stock,
      9,
    );
    assert.equal(
      current.state.products.find((p) => p.sku === "AYS-111").sourceLine,
      1,
    );
    assert.equal(
      current.state.products.find((p) => p.sku === "AYS-172").sourceLine,
      62,
    );
  } finally {
    await db.close();
  }
  const occupied = await setup();
  try {
    await occupied.query(
      "insert into public.ayngaran_products(owner_id,id,name,sku,price,cost,active) values($1,'occupied','Different product','ays-111',50,40,true)",
      [owner],
    );
    await occupied.query(
      "insert into public.ayngaran_inventory(owner_id,id,stock) values($1,'occupied',9)",
      [owner],
    );
    await assert.rejects(occupied.exec(configured()), /SKU.*already exists/);
    await occupied.exec("rollback");
    const current = await stateFor(occupied, owner);
    assert.equal(current.state.products.length, 1);
    assert.equal(current.state.products[0].stock, 9);
    assert.equal(current.state.purchases.length, 0);
    assert.equal(current.state.suppliers.length, 0);
    assert.equal(current.revision, 0);
  } finally {
    await occupied.close();
  }
});
