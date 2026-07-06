/*
 * End-to-end gate runner.
 *
 * Exercises the deployed app (default: https://hefesto.org) through its real
 * HTTP surface, as an authenticated user, covering the automatable phase-gate
 * checks: provision → capture → confirm → forge poll → graph → chat with
 * evidence → feedback → cross-user isolation → forget.
 *
 * Run from app/:
 *   npx tsx scripts/gate-e2e.ts                  # against production
 *   npx tsx scripts/gate-e2e.ts --base http://localhost:3000
 *
 * Creates two throwaway Supabase users (via the service role key), signs in
 * with password, and forges the @supabase/ssr auth cookie so route handlers
 * see a normal browser session. Cleans up users, app rows, and Cognee
 * datasets at the end.
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

import { createClient, type Session } from "@supabase/supabase-js";
import { datasets } from "../lib/cognee";

const BASE_URL = (() => {
  const i = process.argv.indexOf("--base");
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : "https://hefesto.org";
})();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY)");
  process.exit(1);
}

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;
const COOKIE_CHUNK_SIZE = 3180;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results: { step: string; ok: boolean | "skip"; note: string }[] = [];

function log(step: string, ok: boolean | "skip", note: string) {
  results.push({ step, ok, note });
  const mark = ok === "skip" ? "◌" : ok ? "✔" : "✘";
  console.log(`${mark} [${step}] ${note}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function short(value: unknown, max = 220): string {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s && s.length > max ? `${s.slice(0, max)}…` : s ?? "";
}

/** Serialize a Supabase session into the @supabase/ssr cookie format (chunked). */
function sessionCookies(session: Session): string {
  const encoded = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  if (encoded.length <= COOKIE_CHUNK_SIZE) return `${COOKIE_NAME}=${encoded}`;
  const parts: string[] = [];
  for (let i = 0; i * COOKIE_CHUNK_SIZE < encoded.length; i++) {
    parts.push(
      `${COOKIE_NAME}.${i}=${encoded.slice(i * COOKIE_CHUNK_SIZE, (i + 1) * COOKIE_CHUNK_SIZE)}`
    );
  }
  return parts.join("; ");
}

interface TestUser {
  id: string;
  email: string;
  cookie: string;
}

async function createTestUser(tag: string): Promise<TestUser> {
  const email = `gate.${tag}.${Date.now()}@hefesto.org`;
  const password = randomBytes(18).toString("base64url");
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) throw new Error(`createUser(${tag}): ${createError?.message}`);

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signedIn, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signedIn.session) throw new Error(`signIn(${tag}): ${signInError?.message}`);

  return { id: created.user.id, email, cookie: sessionCookies(signedIn.session) };
}

async function api(
  user: TestUser,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      cookie: user.cookie,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON response
  }
  return { status: res.status, json };
}

async function cleanup(users: TestUser[]) {
  console.log("\n— Cleanup —");
  for (const user of users) {
    try {
      const { data: row } = await admin
        .from("users_cognee")
        .select("dataset_id, dataset_name")
        .eq("user_id", user.id)
        .maybeSingle();
      for (const table of ["person_data", "persons", "conversations", "users_cognee"]) {
        await admin.from(table).delete().eq("user_id", user.id);
      }
      if (row?.dataset_id) {
        await datasets.delete(row.dataset_id).catch(() => undefined);
        console.log(`  dataset ${row.dataset_name} deleted`);
      }
      await admin.auth.admin.deleteUser(user.id);
      console.log(`  user ${user.email} deleted`);
    } catch (e) {
      console.log(`  cleanup(${user.email}) failed: ${short((e as Error).message)}`);
    }
  }
}

async function main() {
  console.log(`— Hefesto · E2E gate against ${BASE_URL} —\n`);

  // 0. Surface checks (no auth)
  const root = await fetch(`${BASE_URL}/`, { redirect: "manual" });
  log("surface.root", root.status === 307 || root.status === 308, `GET / → ${root.status} (expect redirect to /login)`);
  const login = await fetch(`${BASE_URL}/login`);
  log("surface.login", login.status === 200, `GET /login → ${login.status}`);
  const manifest = await fetch(`${BASE_URL}/manifest.json`);
  log("surface.manifest", manifest.status === 200, `GET /manifest.json → ${manifest.status}`);
  const tree = await fetch(`${BASE_URL}/m`, { redirect: "manual" });
  log(
    "surface.trees",
    tree.status === 307 || tree.status === 308,
    `GET /m → ${tree.status} (internal trees not addressable)`
  );

  const userA = await createTestUser("a");
  const userB = await createTestUser("b");
  const users = [userA, userB];
  console.log(`\ntest users: ${userA.email} · ${userB.email}\n`);

  try {
    // 1. Provision
    const provision = await api(userA, "POST", "/api/provision");
    log(
      "provision",
      provision.status === 200 && Boolean(provision.json?.datasetName),
      `→ ${provision.status} ${short(provision.json)}`
    );

    // 2. Capture extraction
    const sourceText = "met Carlos, fintech founder, wants an intro to a designer";
    const capture = await api(userA, "POST", "/api/capture", { text: sourceText });
    const extraction = capture.json?.extraction;
    log(
      "capture.extract",
      capture.status === 200 && Boolean(extraction?.name),
      `→ ${capture.status} name="${extraction?.name}" cluster="${extraction?.cluster}"`
    );

    // 3. Confirm → remember
    const confirm = await api(userA, "POST", "/api/capture/confirm", {
      resolution: "new",
      fields: {
        name: extraction?.name ?? "Carlos",
        cluster: extraction?.cluster ?? "work",
        role: extraction?.role ?? "founder",
        company: extraction?.company ?? null,
        interests: extraction?.interests ?? [],
        metAtEvent: extraction?.met_at?.event ?? null,
        metAtDate: extraction?.met_at?.date ?? null,
        relationship: extraction?.relationship ?? "lead",
        facts: extraction?.facts ?? [],
        commitments: extraction?.commitments ?? ["wants an intro to a designer"],
      },
      sourceText,
      channel: "web",
    });
    const { personId, filename } = confirm.json ?? {};
    log(
      "capture.confirm",
      confirm.status === 200 && Boolean(personId) && Boolean(filename),
      `→ ${confirm.status} personId=${personId} filename=${filename}${
        confirm.json?.error ? ` error="${confirm.json.error}"` : ""
      }`
    );
    if (!personId || !filename) throw new Error("confirm failed — cannot continue");

    // 4. Poll forge status
    const t0 = Date.now();
    let forged = "";
    let dataId: string | undefined;
    while (Date.now() - t0 < 3 * 60 * 1000) {
      const status = await api(
        userA,
        "GET",
        `/api/capture/status?filename=${encodeURIComponent(filename)}&personId=${personId}`
      );
      forged = status.json?.status ?? `http ${status.status}`;
      if (forged === "completed") {
        dataId = status.json?.dataId;
        break;
      }
      if (forged === "failed") break;
      await sleep(3000);
    }
    const forgeSeconds = ((Date.now() - t0) / 1000).toFixed(1);
    log("capture.forge", forged === "completed", `status="${forged}" after ${forgeSeconds}s dataId=${dataId ?? "—"}`);

    // 5. Graph contains the captured person (direct Cognee read on user A's dataset)
    const { data: memoryRow } = await admin
      .from("users_cognee")
      .select("dataset_id")
      .eq("user_id", userA.id)
      .maybeSingle();
    if (memoryRow?.dataset_id) {
      const graph = await datasets.graph(memoryRow.dataset_id).catch(() => ({ nodes: [], edges: [] }));
      const hasCarlos = graph.nodes.some((n: { label?: string }) =>
        String(n.label ?? "").toLowerCase().includes("carlos")
      );
      log("graph", hasCarlos, `nodes=${graph.nodes.length} edges=${graph.edges.length} carlos=${hasCarlos}`);
    } else {
      log("graph", false, "users_cognee row not found for user A");
    }

    // 6. Chat with evidence
    const chat = await api(userA, "POST", "/api/chat", { message: "who did I meet from fintech?" });
    const chatOk =
      chat.status === 200 &&
      Boolean(chat.json?.text) &&
      !chat.json?.pending &&
      /carlos/i.test(chat.json?.text ?? "");
    log(
      "chat",
      chatOk,
      `→ ${chat.status} qaId=${chat.json?.qaId ?? "—"} evidence=${chat.json?.evidence?.length ?? 0} text=${short(chat.json?.text, 140)}`
    );

    // 7. Feedback
    if (chat.json?.qaId && chat.json?.sessionId) {
      const feedback = await api(userA, "POST", "/api/feedback", {
        qaId: chat.json.qaId,
        sessionId: chat.json.sessionId,
        thumbs: "up",
      });
      log("feedback", feedback.status === 200 && feedback.json?.ok === true, `→ ${feedback.status} ${short(feedback.json)}`);
    } else {
      log("feedback", "skip", "no qaId/sessionId in chat response — skipped");
    }

    // 8. Isolation: user B must see nothing of user A.
    // /api/capture/status scopes the lookup to the CALLER's dataset, so polling
    // someone else's capture yields a perpetual "forging" — the check is that it
    // never resolves to completed or exposes a dataId.
    await api(userB, "POST", "/api/provision");
    const bStatus = await api(
      userB,
      "GET",
      `/api/capture/status?filename=${encodeURIComponent(filename)}&personId=${personId}`
    );
    const bStatusIsolated =
      bStatus.status === 404 ||
      (bStatus.status === 200 && bStatus.json?.status !== "completed" && !bStatus.json?.dataId);
    log(
      "isolation.rows",
      bStatusIsolated,
      `user B polling user A's capture → ${bStatus.status} ${short(bStatus.json)} (must never complete)`
    );

    const bChat = await api(userB, "POST", "/api/chat", { message: "who did I meet from fintech?" });
    const bLeaked = /carlos/i.test(bChat.json?.text ?? "");
    log(
      "isolation.memory",
      bChat.status === 200 && !bLeaked,
      `user B chat → ${bChat.status} pending=${bChat.json?.pending ?? false} leaked=${bLeaked} text=${short(bChat.json?.text, 100)}`
    );

    // 9. Forget person (route may not exist on older deployments)
    const forget = await api(userA, "POST", "/api/forget", { personId });
    if (forget.status === 404 && !forget.json?.name) {
      log("forget", "skip", "→ 404 (route not present in the deployed build)");
    } else {
      log(
        "forget",
        forget.status === 200 && forget.json?.ok === true,
        `→ ${forget.status} forgot=${forget.json?.forgot} name="${forget.json?.name}"`
      );
    }

    // 10. Newer routes present? (informational — F2+ deploy check)
    for (const probe of ["/api/nudge", "/api/briefing"] as const) {
      const res = await fetch(`${BASE_URL}${probe}`, {
        method: probe === "/api/nudge" ? "POST" : "GET",
        headers: { cookie: userA.cookie },
      });
      log(
        `deployed${probe.replace("/api", "")}`,
        res.status === 404 ? "skip" : res.status < 500,
        `→ ${res.status}${res.status === 404 ? " (not in deployed build)" : ""}`
      );
    }
  } finally {
    await cleanup(users);
  }

  const failures = results.filter((r) => r.ok === false);
  const skipped = results.filter((r) => r.ok === "skip");
  console.log(
    `\nChecks: ${results.length - failures.length - skipped.length}/${results.length - skipped.length} passed` +
      (skipped.length ? ` · ${skipped.length} skipped` : "")
  );
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) console.log(`  ✘ ${f.step}: ${f.note}`);
    process.exit(1);
  }
  console.log("\nGATE: GREEN");
}

main().catch(async (error) => {
  console.error("\nGate aborted:", error instanceof Error ? error.message : error);
  process.exit(1);
});
