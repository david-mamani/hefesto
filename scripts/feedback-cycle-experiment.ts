/*
 * Feedback-cycle experiment — does a stored FeedbackEntry change later recalls?
 *
 * Run from app/:  npx tsx scripts/feedback-cycle-experiment.ts
 *
 * The Cloud REST API has no /improve endpoint; the documented loop is a
 * FeedbackEntry chained to a previous QA's qa_id. This measures, against the
 * seeded demo dataset, whether that entry observably changes answers:
 *
 *   1. BASELINE  — two fresh sessions answer the demo question (drift control).
 *   2. FEEDBACK  — a third session answers, then gets a thumbs-down entry
 *                  ("I already know Leo; suggest someone else").
 *   3. SAME-SESSION — the feedback session re-asks 3× (does it adapt in-session?).
 *   4. CROSS-SESSION — after a settle pause, two fresh sessions re-ask
 *                  (did the feedback change global memory?).
 *
 * Answers are compared on the mentioned people (Leo/Maya present or not) and
 * exact text. Findings go to docs/COGNEE-CLOUD.md.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");

try {
  const env = readFileSync(join(appRoot, ".env.local"), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq <= 0 || line.trimStart().startsWith("#")) continue;
    const key = line.slice(0, eq).trim();
    if (key && !(key in process.env)) process.env[key] = line.slice(eq + 1).trim();
  }
} catch {
  // ambient env
}

import { createClient } from "@supabase/supabase-js";
import { recall, sessions, rememberFeedbackEntry, splitEvidence } from "../lib/cognee";

const DEMO_EMAIL = "demo@hefesto.org";
const QUESTION = "Who can introduce me to someone who runs a gaming studio?";
const FEEDBACK_TEXT = "Not helpful — I already know Leo; suggest someone else.";
const SETTLE_MS = 25_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const short = (s: string, m = 150) => (s.length > m ? `${s.slice(0, m - 1)}…` : s);

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

type Run = { label: string; session: string; text: string; mentions: string[] };

function mentionsOf(text: string): string[] {
  return ["Leo", "Maya", "Carlos", "Ana", "Sofía", "Jorge"].filter((n) =>
    new RegExp(`\\b${n}`, "i").test(text)
  );
}

async function ask(datasetName: string, sessionId: string, label: string): Promise<Run> {
  const raw = await recall({
    query: QUESTION,
    searchType: "GRAPH_COMPLETION",
    datasets: [datasetName],
    sessionId,
    includeReferences: true,
  });
  const answer =
    typeof raw === "string" ? raw : String(findLastKey(raw, "search_result") ?? JSON.stringify(raw));
  const { text } = splitEvidence(answer);
  const run: Run = { label, session: sessionId.slice(0, 8), text, mentions: mentionsOf(text) };
  console.log(`  [${label}] mentions=[${run.mentions.join(",")}] "${short(text)}"`);
  return run;
}

async function main() {
  console.log("— Hefesto · feedback-cycle experiment (demo dataset) —\n");

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const demo = users?.users.find((u) => u.email === DEMO_EMAIL);
  if (!demo) throw new Error("demo user not found");
  const { data: row } = await admin
    .from("users_cognee")
    .select("*")
    .eq("user_id", demo.id)
    .maybeSingle();
  const datasetName = (row?.dataset_name ?? row?.datasetName) as string | undefined;
  if (!datasetName) throw new Error("demo dataset not found in users_cognee");
  console.log(`dataset: ${datasetName}\n`);

  console.log("1. BASELINE — fresh sessions, no feedback:");
  const baseline: Run[] = [];
  for (let i = 0; i < 2; i++) baseline.push(await ask(datasetName, randomUUID(), `base-${i + 1}`));

  console.log("\n2. FEEDBACK — new session answers, then gets a thumbs-down:");
  const fbSession = randomUUID();
  const fbRun = await ask(datasetName, fbSession, "fb-ask");
  const sessionData = await sessions.get(fbSession).catch(() => null);
  const qaId = (findLastKey(sessionData, "qa_id") as string | undefined) ?? null;
  if (!qaId) throw new Error("qa_id not found in session — cannot chain feedback");
  const fbResult = await rememberFeedbackEntry({
    sessionId: fbSession,
    qaId,
    score: 1,
    text: FEEDBACK_TEXT,
    datasetName,
  });
  console.log(`  feedback stored on qa_id=${qaId.slice(0, 8)}… → ${JSON.stringify(fbResult).slice(0, 120)}`);

  console.log("\n3. SAME-SESSION — the feedback session re-asks 3×:");
  const sameSession: Run[] = [];
  for (let i = 0; i < 3; i++) sameSession.push(await ask(datasetName, fbSession, `same-${i + 1}`));

  console.log(`\n   settling ${SETTLE_MS / 1000}s (background processing window)…`);
  await sleep(SETTLE_MS);

  console.log("\n4. CROSS-SESSION — fresh sessions after the feedback:");
  const cross: Run[] = [];
  for (let i = 0; i < 2; i++) cross.push(await ask(datasetName, randomUUID(), `cross-${i + 1}`));

  console.log("\n— Verdict —");
  const baseMentions = new Set(baseline.flatMap((r) => r.mentions));
  const sameChanged = sameSession.some(
    (r) => r.mentions.join(",") !== fbRun.mentions.join(",") || !/\bleo\b/i.test(r.text)
  );
  const crossChanged = cross.some((r) => r.mentions.join(",") !== [...baseMentions].join(","));
  console.log(`baseline mentions: [${[...baseMentions].join(",")}]`);
  console.log(`same-session adapted after feedback: ${sameChanged ? "YES" : "NO"}`);
  console.log(`cross-session (global memory) changed: ${crossChanged ? "YES" : "NO"}`);
  console.log(
    sameChanged || crossChanged
      ? "OBSERVABLE — the feedback loop measurably alters recalls."
      : "NOT OBSERVABLE — feedback is stored but recalls stay unchanged; UI must claim only \"feedback saved\"."
  );
}

main().catch((e) => {
  console.error("aborted:", e instanceof Error ? e.message : e);
  process.exit(1);
});
