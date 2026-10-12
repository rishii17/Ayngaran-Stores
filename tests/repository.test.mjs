import test from "node:test";
import assert from "node:assert/strict";
import { loadStore, commitStore } from "../server/store-repository.mjs";
import { emptyState, seedState, applyAction } from "../lib/domain.mjs";

test("repository uses relational RPCs and sends only changed rows", async () => {
  const state = seedState(),
    current = { state, revision: 3, storageVersion: 2 };
  const calls = [];
  const db = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: current };
    },
  };
  assert.deepEqual(await loadStore(db, "owner"), current);
  const changed = applyAction(state, {
    type: "price",
    payload: {
      productId: state.products[0].id,
      price: 250,
      cost: 210,
      reason: "Test",
    },
  });
  await commitStore(db, current, "request", changed, "price");
  assert.equal(calls[1].name, "ayngaran_commit_v2");
  assert.equal(calls[1].args.p_changes.products.length, 1);
  assert.equal(calls[1].args.p_changes.price_history.length, 1);
  assert.equal(calls[1].args.p_changes.inventory.length, 0);
  assert.equal(calls[1].args.p_changes.sales.length, 0);
  assert.equal(calls[1].args.p_changes._action, "price");
  assert.equal("p_state" in calls[1].args, false);
});
test("legacy fallback is limited to missing RPC and never hides real database errors", async () => {
  const state = emptyState();
  const old = {
    rpc: async () => ({ error: { code: "PGRST202" } }),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { state, revision: 0 } }),
        }),
      }),
    }),
  };
  assert.equal((await loadStore(old, "owner")).storageVersion, 1);
  for (const code of ["42501", "23505", "42883", "XX000"])
    await assert.rejects(
      loadStore(
        { rpc: async () => ({ error: { code, message: "Database failure" } }) },
        "owner",
      ),
      (e) => e.code === code,
    );
});

test("missing RPC never exposes a migrated store's stale archive", async () => {
  const db = {
    rpc: async () => ({ error: { code: "PGRST202" } }),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { state: emptyState(), revision: 10, schema_version: 2 },
          }),
        }),
      }),
    }),
  };
  await assert.rejects(loadStore(db, "owner"), /legacy archive cannot/);
});
