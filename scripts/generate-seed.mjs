import { writeFileSync } from "node:fs";
import { seedWithTransactions } from "../lib/domain.mjs";
const state = seedWithTransactions();
const json = JSON.stringify(state);
writeFileSync(
  new URL("../supabase/dummy-data.sql", import.meta.url),
  `-- Generated dummy records; this does not modify any owner's store.\ninsert into public.ayngaran_seed_templates(name,state) values ('grocery-v1','${json.replaceAll("'", "''")}'::jsonb) on conflict (name) do update set state=excluded.state,updated_at=now();\n`,
);
console.log(
  "Generated dummy template: 16 products, 3 customers, 2 suppliers, 7 sales, 1 purchase and 1 collection.",
);
