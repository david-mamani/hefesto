/*
 * Cognee Cloud contract smoke test.
 *
 * Run from app/:  npx tsx scripts/smoke-cognee.ts
 *
 * Exercises the full memory cycle against a scratch dataset and probes the
 * isolation checks that decide the P2 (platform-enforced) vs P1 (app-enforced)
 * branch. Prints measured latencies, any API discrepancies found, and a final
 * verdict line: P2_OK or FALLBACK_P1.
 *
 * Contract notes discovered against the live tenant Swagger:
 *  - remember with session_id stores to the SESSION cache (bridged to the graph
 *    in the background); captures that must be pollable go WITHOUT session_id.
 *  - recall/search/forget DTOs use camelCase field names.
 *  - /remember/entry takes a discriminated union: {entry: {type: "feedback", qa_id, …}}.
 *  - No /improve endpoint exists in the Cloud REST API.
 *  - No principal-creation endpoint exists on the data plane (no /auth/register);
 *    /agents/register creates connections for the SAME authenticated user.
 *  - /permissions/datasets/{principal_id} exposes POST (grant) only — no revoke.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, randomBytes } from "node:crypto";

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

import {
  datasets,
  remember,
  recall,
  forget,
  sessions,
  rememberFeedbackEntry,
  ontologies,
  principals,
  splitEvidence,
  CogneeError,
} from "../lib/cognee";

const ONTOLOGY_KEY = "hefesto_relationships_v1";
const DATASET = "smoke_test";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

const results: { step: string; ok: boolean; note: string }[] = [];
const discrepancies: string[] = [];

function log(step: string, ok: boolean, note: string) {
  results.push({ step, ok, note });
  console.log(`${ok ? "✔" : "✘"} [${step}] ${note}`);
}

function noteDiscrepancy(text: string) {
  discrepancies.push(text);
  console.log(`  ⚠ discrepancy: ${text}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function short(value: unknown, max = 300): string {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s && s.length > max ? `${s.slice(0, max)}…` : s ?? "";
}

/** Deep-scan a JSON value for the last occurrence of a given key. */
function findLastKey(value: unknown, key: string): unknown {
  let found: unknown;
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, inner] of Object.entries(v as Record<string, unknown>)) {
        if (k === key && inner !== null && inner !== undefined) found = inner;
        walk(inner);
      }
    }
  };
  walk(value);
  return found;
}

async function pollUntilComplete(datasetId: string): Promise<{ status: string; ms: number }> {
  const t0 = Date.now();
  let status = "";
  while (Date.now() - t0 < POLL_TIMEOUT_MS) {
    const statuses = await datasets.status([datasetId]);
    const value = statuses?.[datasetId];
    status =
      typeof value === "string"
        ? value
        : String(findLastKey(value, "status") ?? JSON.stringify(value ?? ""));
    if (/completed|failed/i.test(status)) break;
    await sleep(POLL_INTERVAL_MS);
  }
  return { status, ms: Date.now() - t0 };
}

async function main() {
  console.log("— Hefesto · Cognee Cloud smoke test —\n");

  // (a) get-or-create scratch dataset
  const dataset = await datasets.getOrCreate(DATASET);
  log("a", Boolean(dataset?.id), `dataset "${DATASET}" id=${dataset.id}`);

  // (b) ontology present + remember one note with it (NO session_id → pollable pipeline)
  const existing = (await ontologies.list().catch(() => [])) as unknown[];
  const hasOntology = JSON.stringify(existing).includes(ONTOLOGY_KEY);
  if (!hasOntology) {
    const owl = readFileSync(join(appRoot, "ontology", "hefesto.owl"), "utf8");
    await ontologies.upload(ONTOLOGY_KEY, owl, "Hefesto relationship memory ontology");
  }
  log("b1", true, hasOntology ? "ontology already uploaded" : "ontology uploaded");

  const filename = `capture_${randomUUID()}.md`;
  const note =
    "I met Leo Park at DevFest 2026 in Lima. Leo is a game designer who works at " +
    "PixelForge. Leo knows Maya Chen, who runs a gaming studio called Ember Works. " +
    "Leo is into speedrunning, and he wants an intro to a product designer.";

  const tRemember = Date.now();
  const rememberResult = await remember({
    filename,
    content: note,
    datasetName: DATASET,
    ontologyKey: ONTOLOGY_KEY,
    nodeSet: ["work"],
    runInBackground: true,
  });
  const rememberMs = Date.now() - tRemember;
  log("b2", true, `remember accepted in ${rememberMs}ms → ${short(rememberResult, 160)}`);

  // (c) poll status until completed, measuring real latency
  const { status, ms: cognifyMs } = await pollUntilComplete(dataset.id);
  const completed = /completed/i.test(status);
  log("c", completed, `status="${status}" after ${(cognifyMs / 1000).toFixed(1)}s (remember→graph latency)`);
  if (!completed) throw new Error(`cognify did not complete: ${status}`);

  // (d) multi-hop recall with references + session
  const sessionId = randomUUID();
  const question = "Who can introduce me to someone who runs a gaming studio?";
  const tRecall = Date.now();
  const answer = await recall({
    query: question,
    searchType: "GRAPH_COMPLETION_COT",
    datasets: [DATASET],
    sessionId,
    includeReferences: true,
  });
  const recallMs = Date.now() - tRecall;
  // recall returns [{kind, search_type, text}] — the Evidence block lives inside .text
  const answerText =
    typeof answer === "string"
      ? answer
      : String(findLastKey(answer, "text") ?? short(answer));
  const { text, evidence } = splitEvidence(answerText);
  log(
    "d",
    text.length > 0,
    `recall in ${recallMs}ms · evidence block: ${evidence ? "YES" : "NO"} · answer: ${short(text, 200)}`
  );
  if (!evidence) noteDiscrepancy("includeReferences did not append an Evidence: block");

  // (e) graph shape
  const graph = await datasets.graph(dataset.id);
  const graphOk = Array.isArray(graph?.nodes) && Array.isArray(graph?.edges);
  log("e", graphOk, `graph nodes=${graph?.nodes?.length ?? "?"} edges=${graph?.edges?.length ?? "?"}`);
  const nodesBefore = graph.nodes.length;

  // (f) feedback chain: session → qa_id → FeedbackEntry (no /improve in REST)
  let qaId: string | undefined;
  try {
    const session = await sessions.get(sessionId);
    qaId = findLastKey(session, "qa_id") as string | undefined;
    if (!qaId)
      noteDiscrepancy(`session has no qa_id — session payload: ${short(session, 240)}`);
  } catch (e) {
    noteDiscrepancy(`GET /sessions/{id} failed: ${short((e as Error).message)}`);
  }

  if (qaId) {
    try {
      const entry = await rememberFeedbackEntry({
        sessionId,
        qaId,
        score: 5,
        text: "helpful",
        datasetName: DATASET,
      });
      log("f1", true, `FeedbackEntry stored → ${short(entry, 140)}`);
    } catch (e) {
      const err = e as CogneeError;
      log("f1", false, `remember/entry failed (${err.status}): ${short(err.body, 220)}`);
    }
  }
  log(
    "f2",
    true,
    "no /improve endpoint in Cloud REST (verified in Swagger) — feedback loop = stored FeedbackEntry chained to qa_id"
  );

  // (g) forget the data item → node count should drop
  const items = await datasets.data(dataset.id);
  const item = items.find(
    (i) => i.name === filename || `${i.name}${i.extension ?? ""}` === filename || i.name === filename.replace(/\.md$/, "")
  );
  if (!item) {
    log("g", false, `data item not found by filename "${filename}" — names: ${short(items.map((i) => i.name))}`);
    noteDiscrepancy("data item name does not match uploaded filename");
  } else {
    await forget({ datasetId: dataset.id, dataId: item.id });
    await sleep(2000);
    const graphAfter = await datasets.graph(dataset.id).catch(() => ({ nodes: [], edges: [] }));
    log(
      "g",
      graphAfter.nodes.length < nodesBefore,
      `forget dataId=${item.id} → nodes ${nodesBefore} → ${graphAfter.nodes.length}`
    );
  }

  // ---------- (h) P2 isolation checks ----------
  console.log("\n— P2 isolation checks —");
  let p2ok = true;

  // (h1) principal creation under the master key: probe /auth/register empirically
  try {
    await principals.register(
      `smoke_principal_${Date.now()}@principals.hefesto.org`,
      randomBytes(18).toString("base64url")
    );
    log("h1", true, "auth/register unexpectedly exists — re-evaluate P2 wiring");
  } catch (e) {
    const err = e as CogneeError;
    log("h1", false, `auth/register → ${err.status || "network"} (${short(err.body, 120) || "no body"})`);
  }

  // (h2-h4) facts from the live tenant OpenAPI (downloaded during this phase):
  //   - no principal-creation endpoint on the data plane
  //   - /agents/register creates connections for the SAME authenticated user (not a principal)
  //   - /permissions/datasets/{principal_id} has POST only — no revoke for the
  //     default tenant-wide grant on new datasets
  //   - /tenants/users invites by email → the end user would have to register with
  //     Cognee themselves (excluded by product design)
  log("h2", false, "no revoke endpoint for the default tenant-wide grant (Swagger: POST only)");
  log("h3", false, "no way to authenticate as a per-user principal (no register/login on data plane)");
  log("h4", false, "isolation cannot be platform-enforced per app user → app-enforced scoping (P1)");
  p2ok = false;

  // ---------- report ----------
  console.log("\n— Summary —");
  console.log(`remember call: ${rememberMs}ms`);
  console.log(`remember→graph (cognify) latency: ${(cognifyMs / 1000).toFixed(1)}s`);
  console.log(`recall (GRAPH_COMPLETION_COT + references): ${recallMs}ms`);
  if (discrepancies.length) {
    console.log("\nDiscrepancies found:");
    for (const d of discrepancies) console.log(`  - ${d}`);
  }
  const failures = results.filter((r) => !r.ok);
  console.log(`\nChecks: ${results.length - failures.length}/${results.length} passed`);
  console.log(`\nVERDICT: ${p2ok ? "P2_OK" : "FALLBACK_P1"}`);
}

main().catch((error) => {
  console.error("\nSmoke test aborted:", error instanceof Error ? error.message : error);
  if (error instanceof CogneeError) {
    console.error(`  path=${error.path} status=${error.status} body=${short(error.body, 300)}`);
  }
  console.log("\nVERDICT: FALLBACK_P1 (aborted before isolation checks)");
  process.exit(1);
});
