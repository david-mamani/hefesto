/* Sweep leaked gate fixtures: any gate.*@hefesto.org auth users left behind by
 * an interrupted run, plus their Cognee datasets and registry rows.
 *
 * Run from app/:  npx tsx scripts/sweep-gate-leaks.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(here, "..", ".env.local"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const eq = line.indexOf("=");
  if (eq <= 0 || line.trimStart().startsWith("#")) continue;
  const key = line.slice(0, eq).trim();
  if (key && !(key in process.env)) process.env[key] = line.slice(eq + 1).trim();
}

import { datasets } from "../lib/cognee";

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const leaked = (data?.users ?? []).filter((u) => /^gate\./.test(u.email ?? ""));
  if (!leaked.length) {
    console.log("no leaked gate users — clean");
    return;
  }
  for (const user of leaked) {
    console.log(`leaked: ${user.email}`);
    const { data: row } = await admin
      .from("users_cognee")
      .select("dataset_id, dataset_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: persons } = await admin.from("persons").select("person_id").eq("user_id", user.id);
    const ids = (persons ?? []).map((p) => p.person_id);
    if (ids.length) await admin.from("person_data").delete().in("person_id", ids);
    for (const table of [
      "capture_notes",
      "telegram_captures",
      "telegram_links",
      "link_tokens",
      "conversations",
      "persons",
      "users_cognee",
    ]) {
      await admin.from(table).delete().eq("user_id", user.id);
    }
    if (row?.dataset_id) {
      await datasets.delete(row.dataset_id).catch(() => undefined);
      console.log(`  cognee dataset ${row.dataset_name} deleted`);
    }
    await admin.auth.admin.deleteUser(user.id);
    console.log("  rows + user deleted");
  }
}

main().catch((e) => {
  console.error("aborted:", e instanceof Error ? e.message : e);
  process.exit(1);
});
