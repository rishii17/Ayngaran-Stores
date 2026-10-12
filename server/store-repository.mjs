import { emptyState } from "../lib/domain.mjs";
import { relationalChanges } from "./relational-model.mjs";

export async function loadStore(db, ownerId) {
  const normalized = await db.rpc("ayngaran_load_v2", {
    p_initial: emptyState(),
  });
  if (!normalized.error) return normalized.data;
  // A rolling deployment can ship this code before the migration. Never fall
  // back for permissions, constraint errors or other real database failures.
  if (normalized.error.code !== "PGRST202") throw normalized.error;
  const { data, error } = await db
    .from("ayngaran_stores")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  if (data?.schema_version === 2)
    throw Error(
      "The relational database API is missing. Reload the Supabase schema cache and retry; the legacy archive cannot be used as live data.",
    );
  if (data)
    return { state: data.state, revision: data.revision, storageVersion: 1 };
  const created = await db
    .from("ayngaran_stores")
    .insert({ owner_id: ownerId, state: emptyState() })
    .select("state,revision")
    .single();
  if (created.error?.code === "23505") return loadStore(db, ownerId);
  if (created.error) throw created.error;
  return { ...created.data, storageVersion: 1 };
}
export async function commitStore(db, current, requestId, changed, actionType) {
  const relational = current.storageVersion === 2;
  const { data, error } = await db.rpc(
    relational ? "ayngaran_commit_v2" : "ayngaran_commit",
    {
      p_revision: current.revision,
      p_request_id: requestId,
      ...(relational
        ? {
            p_changes: {
              ...relationalChanges(current.state, changed.state),
              _action: actionType,
            },
          }
        : { p_state: changed.state }),
      p_result: changed.result,
    },
  );
  if (error) throw error;
  return data;
}
