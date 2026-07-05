/*
 * Demo seed for the Acto 6 video — idempotent (reset + populate).
 *
 * Run from app/:  npx tsx scripts/seed-demo.ts <demo-user-email>
 * (or set DEMO_USER_EMAIL). The email must belong to an existing Supabase user
 * — sign in once at hefesto.org first so the account + dataset exist.
 *
 * What it does, against that user's own dataset (identity always derives from the
 * user, never from input):
 *   1. wipe the app registry (persons/person_data) and the Cognee dataset graph
 *   2. remember the fixed cast as real captures (ontology + node_set per cluster)
 *   3. poll until every capture's graph is built
 *   4. record persons/person_data with STAGGERED last_interaction so warmth varies
 *   5. verify the guaranteed multi-hop: "who can intro me to someone in gaming?"
 *      → You → Leo → Maya (Ember Works, a gaming studio)
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");

// Minimal .env.local loader (values never printed)
try {
  const env = readFileSync(join(appRoot, ".env.local"), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq <= 0 || line.trimStart().startsWith("#")) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
} catch {
  // rely on the ambient environment
}

import { datasets, remember, forget, recall, splitEvidence } from "../lib/cognee";
import { buildCaptureMarkdown, ONTOLOGY_KEY, type ConfirmedFields } from "../lib/capture";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin env vars are not set");
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------- the cast (exact universe of the video) ----------

type SeedPerson = { slug: string; daysAgo: number; sourceText: string; fields: ConfirmedFields };

const fields = (f: Partial<ConfirmedFields> & Pick<ConfirmedFields, "name" | "cluster">): ConfirmedFields => ({
  role: null,
  company: null,
  interests: [],
  metAtEvent: null,
  metAtDate: null,
  relationship: null,
  facts: [],
  commitments: [],
  ...f,
});

const CAST: SeedPerson[] = [
  {
    slug: "ana",
    daysAgo: 0,
    sourceText:
      "Had coffee with Ana García today. Her dog Toby was sick last week but he's better now. She runs a small design studio and is hiring a designer.",
    fields: fields({
      name: "Ana García",
      cluster: "personal",
      relationship: "friend",
      metAtEvent: "coffee",
      facts: ["Ana's dog Toby was sick last week but is better now", "Ana runs a small design studio"],
      commitments: ["is hiring a designer"],
    }),
  },
  {
    // Maya Chen is intentionally NOT a captured contact — she lives inside Leo's
    // note as a second-degree entity so the graph yields a genuine 2-hop referral:
    // You → Leo → Maya (Ember Works, a gaming studio). Verified by the smoke test.
    slug: "leo",
    daysAgo: 3,
    sourceText:
      "Met Leo Park at DevFest. Leo is a game designer at PixelForge. Leo knows Maya Chen, who runs a gaming studio called Ember Works and is looking for pixel artists. Leo is into speedrunning and wants an intro to a product designer.",
    fields: fields({
      name: "Leo Park",
      cluster: "work",
      role: "game designer",
      company: "PixelForge",
      relationship: "colleague",
      interests: ["speedrunning"],
      metAtEvent: "DevFest",
      facts: ["Leo knows Maya Chen, who runs a gaming studio called Ember Works and is looking for pixel artists"],
      commitments: ["wants an intro to a product designer"],
    }),
  },
  {
    slug: "sofia",
    daysAgo: 14,
    sourceText:
      "Caught up with Sofía two weeks ago. She's a friend from art school and does illustration work.",
    fields: fields({
      name: "Sofía",
      cluster: "personal",
      role: "illustrator",
      relationship: "friend",
      facts: ["Sofía is a friend from art school", "Sofía does illustration work"],
    }),
  },
  {
    slug: "mom",
    daysAgo: 30,
    sourceText: "Called Mom about a month ago. She's planning a trip to the coast.",
    fields: fields({
      name: "Mom",
      cluster: "family",
      relationship: "family",
      facts: ["Mom is planning a trip to the coast"],
    }),
  },
  {
    slug: "jorge",
    daysAgo: 60,
    sourceText:
      "Jorge is my cousin. We haven't talked in two months — last time he mentioned starting a new job.",
    fields: fields({
      name: "Jorge",
      cluster: "family",
      relationship: "family",
      facts: ["Jorge is my cousin", "Jorge mentioned starting a new job"],
    }),
  },
];

// ---------- helpers ----------

async function resolveUserId(sb: ReturnType<typeof admin>, email: string): Promise<string> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const user = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (user) return user.id;
    if (data.users.length < 200) break;
  }
  throw new Error(`No Supabase user with email ${email} — sign in once at hefesto.org first.`);
}

function datasetNameFor(userId: string): string {
  return `user_${userId.replaceAll("-", "")}`;
}

/** Wipe app registry + Cognee graph for a clean, non-duplicating re-seed. */
async function reset(
  sb: ReturnType<typeof admin>,
  userId: string,
  datasetId: string
): Promise<void> {
  const { data: persons } = await sb.from("persons").select("person_id").eq("user_id", userId);
  const personIds = (persons ?? []).map((p) => p.person_id as string);
  if (personIds.length) {
    await sb.from("person_data").delete().in("person_id", personIds);
    await sb.from("persons").delete().eq("user_id", userId);
  }

  // Forget each data item by id (the smoke-proven path: whole-dataset forget and
  // DELETE /datasets/{id} both 500 on this tenant), then drop the raw item so the
  // re-seed can't duplicate.
  const items = await datasets.data(datasetId).catch(() => []);
  for (const item of items) {
    await forget({ datasetId, dataId: item.id }).catch((e) =>
      console.warn(`  forget ${item.id}: ${(e as Error).message}`)
    );
    await datasets.deleteData(datasetId, item.id).catch(() => {});
  }
  await sleep(1500);
}

async function graphNodeCount(datasetId: string): Promise<number> {
  const g = await datasets.graph(datasetId).catch(() => ({ nodes: [] as unknown[] }));
  return g.nodes?.length ?? 0;
}

/*
 * Remember ONE capture and wait for its graph to build. Captures are SERIALIZED:
 * firing several remembers at once makes Cognee run concurrent cognify passes on
 * the same dataset, which intermittently errors the pipeline. One at a time is how
 * a real user captures anyway. Completion = data item present + status completed +
 * the graph actually grew (guards the "completed from the previous run" race).
 */
async function rememberOne(
  datasetId: string,
  datasetName: string,
  filename: string,
  content: string,
  cluster: "work" | "personal" | "family",
  timeoutMs = 4 * 60 * 1000
): Promise<void> {
  const stem = filename.replace(/\.md$/, "");
  const before = await graphNodeCount(datasetId);
  await remember({
    filename,
    content,
    datasetName,
    ontologyKey: ONTOLOGY_KEY,
    nodeSet: [cluster],
    runInBackground: true,
  });
  await sleep(3000); // let the run register before polling status

  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const items = await datasets.data(datasetId).catch(() => []);
    const present = items.some((i) => i.name === filename || i.name === stem);
    const statuses = await datasets.status([datasetId]).catch(() => ({} as Record<string, unknown>));
    const st = JSON.stringify(statuses[datasetId] ?? "");
    if (/errored|failed/i.test(st)) throw new Error(`pipeline errored on ${filename}: ${st}`);
    if (present && /completed/i.test(st) && (await graphNodeCount(datasetId)) > before) return;
    await sleep(3000);
  }
  throw new Error(`capture ${filename} did not build in time`);
}

// ---------- main ----------

async function main() {
  const email = (process.argv[2] || process.env.DEMO_USER_EMAIL || "").trim();
  if (!email) throw new Error("Usage: npx tsx scripts/seed-demo.ts <demo-user-email>");

  const sb = admin();
  console.log(`— Hefesto · demo seed —\ntarget: ${email}`);

  const userId = await resolveUserId(sb, email);
  const datasetName = datasetNameFor(userId);

  // Ensure the dataset row exists (created on first login; create if this account
  // has never captured yet).
  const { data: existing } = await sb
    .from("users_cognee")
    .select("dataset_id")
    .eq("user_id", userId)
    .maybeSingle();
  let datasetId: string;
  if (existing?.dataset_id) {
    datasetId = existing.dataset_id;
  } else {
    const created = await datasets.getOrCreate(datasetName);
    datasetId = created.id;
    await sb.from("users_cognee").upsert({
      user_id: userId,
      dataset_id: datasetId,
      dataset_name: datasetName,
      isolation_pattern: "p1",
    });
  }

  console.log("resetting dataset + registry…");
  await reset(sb, userId, datasetId);

  console.log(`remembering ${CAST.length} captures (serialized)…`);
  for (const person of CAST) {
    const filename = `seed_${person.slug}.md`;
    const content = buildCaptureMarkdown({
      canonicalName: person.fields.name,
      fields: person.fields,
      sourceText: person.sourceText,
      channel: "web",
      capturedAt: daysAgo(person.daysAgo),
    });
    process.stdout.write(`  forging ${person.fields.name}… `);
    const started = Date.now();
    await rememberOne(datasetId, datasetName, filename, content, person.fields.cluster);
    console.log(`✔ ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }

  const items = await datasets.data(datasetId);

  console.log("recording persons + person_data (staggered warmth)…");
  const byStem = new Map(items.map((i) => [i.name.replace(/\.md$/, ""), i]));
  for (const person of CAST) {
    const item = byStem.get(`seed_${person.slug}`);
    if (!item) {
      console.warn(`  ! no data item for ${person.slug} — skipped`);
      continue;
    }
    const { data: inserted, error } = await sb
      .from("persons")
      .insert({
        user_id: userId,
        canonical_name: person.fields.name,
        aliases: [],
        cluster: person.fields.cluster,
        last_interaction: daysAgo(person.daysAgo).toISOString(),
      })
      .select("person_id")
      .single();
    if (error || !inserted) {
      console.warn(`  ! could not record ${person.fields.name}: ${error?.message}`);
      continue;
    }
    await sb.from("person_data").insert({
      person_id: inserted.person_id,
      data_id: item.id,
      filename: `seed_${person.slug}.md`,
    });
    console.log(`  ✔ ${person.fields.name} (${person.fields.cluster}, ${person.daysAgo}d)`);
  }

  // Verify the guaranteed multi-hop path. This exact phrasing reliably leads with
  // the referral (Leo → Maya); "someone in gaming" makes Maya the direct answer.
  const DEMO_QUESTION = "Who can introduce me to someone who runs a gaming studio?";
  console.log(`\nverifying multi-hop: “${DEMO_QUESTION}”`);
  const graph = await datasets.graph(datasetId).catch(() => ({ nodes: [], edges: [] }));
  console.log(`  graph: ${graph.nodes.length} nodes · ${graph.edges.length} edges`);
  const raw = await recall({
    query: DEMO_QUESTION,
    searchType: "GRAPH_COMPLETION",
    datasets: [datasetName],
    includeReferences: true,
  });
  const answerText = Array.isArray(raw)
    ? String((raw[0] as { text?: string })?.text ?? "")
    : String(raw ?? "");
  const { text, evidence } = splitEvidence(answerText);
  console.log(`  answer: ${text}`);
  const hitsLeo = /leo/i.test(text);
  const hitsMaya = /maya/i.test(text);
  console.log(`  mentions Leo: ${hitsLeo ? "YES" : "NO"} · Maya: ${hitsMaya ? "YES" : "NO"} · evidence: ${evidence ? "YES" : "NO"}`);
  console.log(`\n${hitsLeo && hitsMaya ? "✅ seed ready — the gaming path is live." : "⚠️ path not confirmed — review the answer above."}`);
}

main().catch((error) => {
  console.error("\nseed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
