/*
 * F4 Telegram gate — exercises the bot webhook as Telegram would, with
 * simulated updates from fake chats, and verifies every DB effect: deep-link
 * /start handshake, capture card → edit → save → graph, "?" recall wiring,
 * unlinked-chat behavior, webhook auth and cross-user isolation. Outbound
 * sendMessage calls fail on fake chat ids by design (the bot swallows them);
 * what Telegram users SEE is the phone checklist.
 *
 * Run from app/ (against a local dev server):
 *   npx tsx scripts/gate-f4-telegram.ts --base http://localhost:3000
 * or against production (creates and removes its own rows):
 *   npx tsx scripts/gate-f4-telegram.ts
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

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

import { createClient, type Session } from "@supabase/supabase-js";
import { datasets } from "../lib/cognee";

const BASE = (() => {
  const i = process.argv.indexOf("--base");
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : "https://hefesto.org";
})();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY)");
  process.exit(1);
}
if (!WEBHOOK_SECRET) {
  console.error("TELEGRAM_WEBHOOK_SECRET is not set — the webhook cannot be exercised");
  process.exit(1);
}

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;
const CHUNK = 3180;

// Fake chats Telegram will never assign (negative ids belong to groups; these
// stay unique per run so parallel runs can't collide).
const CHAT_A = -(Date.now() % 1_000_000_000) - 1_000_000_000;
const CHAT_B = CHAT_A - 1;
const CHAT_STRANGER = CHAT_A - 2;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results: { step: string; ok: boolean; note: string }[] = [];
function log(step: string, ok: boolean, note: string) {
  results.push({ step, ok, note });
  console.log(`${ok ? "✔" : "✘"} [${step}] ${note}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const short = (v: unknown, m = 160) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s && s.length > m ? `${s.slice(0, m)}…` : s ?? "";
};

/** Poll until fn returns a truthy value or the timeout elapses. */
async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, timeoutMs: number, stepMs = 1500): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value as T;
    if (Date.now() > deadline) return null;
    await sleep(stepMs);
  }
}

function sessionCookies(session: Session): string {
  const encoded = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  if (encoded.length <= CHUNK) return `${COOKIE_NAME}=${encoded}`;
  const parts: string[] = [];
  for (let i = 0; i * CHUNK < encoded.length; i++) {
    parts.push(`${COOKIE_NAME}.${i}=${encoded.slice(i * CHUNK, (i + 1) * CHUNK)}`);
  }
  return parts.join("; ");
}

interface TestUser {
  id: string;
  email: string;
  cookie: string;
}

async function createTestUser(tag: string): Promise<TestUser> {
  const email = `gate.tg${tag}.${Date.now()}@hefesto.org`;
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
  const { data: signedIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError || !signedIn.session) throw new Error(`signIn(${tag}): ${signInError?.message}`);
  return { id: created.user.id, email, cookie: sessionCookies(signedIn.session) };
}

async function api(user: TestUser, method: string, path: string) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { cookie: user.cookie } });
  let json: any = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

async function webhook(update: unknown, secret = WEBHOOK_SECRET!) {
  const res = await fetch(`${BASE}/api/telegram`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
    body: JSON.stringify(update),
  });
  return res.status;
}

const textMsg = (chatId: number, text: string) => ({ message: { chat: { id: chatId }, text } });
const callback = (chatId: number, data: string) => ({
  callback_query: { id: `cb-${Date.now()}`, data, message: { chat: { id: chatId }, message_id: 1 } },
});

async function cleanup(users: TestUser[]) {
  console.log("\n— Cleanup —");
  for (const user of users) {
    try {
      const { data: row } = await admin
        .from("users_cognee")
        .select("dataset_id, dataset_name")
        .eq("user_id", user.id)
        .maybeSingle();
      const { data: persons } = await admin.from("persons").select("person_id").eq("user_id", user.id);
      const personIds = (persons ?? []).map((p) => p.person_id);
      if (personIds.length) await admin.from("person_data").delete().in("person_id", personIds);
      for (const table of ["capture_notes", "telegram_captures", "telegram_links", "link_tokens", "conversations", "persons", "users_cognee"]) {
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
  console.log(`— Hefesto · F4 Telegram gate against ${BASE} —\n`);

  const userA = await createTestUser("a");
  const userB = await createTestUser("b");
  const users = [userA, userB];
  console.log(`test users: ${userA.email} · ${userB.email}\n`);

  try {
    // 1. Webhook auth: wrong secret is rejected
    const badAuth = await webhook(textMsg(CHAT_STRANGER, "hi"), "wrong-secret");
    log("webhook.auth", badAuth === 401, `wrong secret → ${badAuth}`);

    // 2. Link token minting (the Connect Telegram surface)
    const mint = await api(userA, "POST", "/api/telegram/link");
    const url: string = mint.json?.url ?? "";
    const token = url.split("start=")[1] ?? "";
    log(
      "link.mint",
      mint.status === 200 && /^https:\/\/t\.me\/.+\?start=.+/.test(url) && Boolean(mint.json?.qrDataUrl),
      `→ ${mint.status} url=${short(url, 60)} qr=${mint.json?.qrDataUrl ? "yes" : "no"}`
    );

    // 3. /start with a bogus token must NOT link
    await webhook(textMsg(CHAT_A, "/start not-a-real-token"));
    await sleep(2500);
    const { data: badLink } = await admin
      .from("telegram_links")
      .select("user_id")
      .eq("telegram_chat_id", CHAT_A)
      .maybeSingle();
    log("start.badtoken", !badLink, badLink ? "LINKED with a bogus token!" : "bogus token rejected");

    // 4. /start with the real token links chat A → user A
    await webhook(textMsg(CHAT_A, `/start ${token}`));
    const linkA = await waitFor(async () => {
      const { data } = await admin
        .from("telegram_links")
        .select("user_id")
        .eq("telegram_chat_id", CHAT_A)
        .maybeSingle();
      return data?.user_id === userA.id ? data : null;
    }, 15_000);
    log("start.link", Boolean(linkA), linkA ? `chat ${CHAT_A} → ${userA.email}` : "link row never appeared");

    // 5. Token is single-use: replaying it must not relink chat B
    await webhook(textMsg(CHAT_B, `/start ${token}`));
    await sleep(2500);
    const { data: replay } = await admin
      .from("telegram_links")
      .select("user_id")
      .eq("telegram_chat_id", CHAT_B)
      .maybeSingle();
    log("start.singleuse", !replay, replay ? "token REPLAYED successfully!" : "replay rejected");

    // 6. Text capture → pending card row through the same extraction pipeline
    await webhook(textMsg(CHAT_A, "Met Elena Brooks at the climbing gym, she teaches yoga and wants to try my favorite bouldering spot"));
    const pending = await waitFor(async () => {
      const { data } = await admin
        .from("telegram_captures")
        .select("id, fields, status")
        .eq("user_id", userA.id)
        .maybeSingle();
      return data ?? null;
    }, 20_000);
    const fieldsName = (pending?.fields as { name?: string })?.name ?? "";
    log(
      "capture.card",
      Boolean(pending) && /elena/i.test(fieldsName),
      pending ? `card name="${fieldsName}" status=${pending.status}` : "no pending capture appeared"
    );

    // 7. ✏️ Edit claims the next message as a correction
    if (pending) {
      await webhook(callback(CHAT_A, `edit:${pending.id}`));
      const editing = await waitFor(async () => {
        const { data } = await admin
          .from("telegram_captures")
          .select("status")
          .eq("id", pending.id)
          .maybeSingle();
        return data?.status === "editing" ? data : null;
      }, 10_000);

      await webhook(textMsg(CHAT_A, "Actually she teaches pilates, not yoga"));
      const corrected = await waitFor(async () => {
        const { data } = await admin
          .from("telegram_captures")
          .select("fields, status")
          .eq("id", pending.id)
          .maybeSingle();
        return data?.status === "pending" ? data : null;
      }, 20_000);
      const factsBlob = JSON.stringify(corrected?.fields ?? {}).toLowerCase();
      log(
        "capture.edit",
        Boolean(editing) && Boolean(corrected) && factsBlob.includes("pilates"),
        `editing=${Boolean(editing)} corrected=${Boolean(corrected)} mentions-pilates=${factsBlob.includes("pilates")}`
      );

      // 8. ✅ Save → forge → person lands in user A's graph registry, and the
      // pending card row is cleaned once the forge completes.
      await webhook(callback(CHAT_A, `save:${pending.id}`));
      const person = await waitFor(async () => {
        const { data } = await admin
          .from("persons")
          .select("person_id, canonical_name")
          .eq("user_id", userA.id)
          .maybeSingle();
        return data ?? null;
      }, 120_000, 3000);
      const cleaned = await waitFor(async () => {
        const { data } = await admin
          .from("telegram_captures")
          .select("id")
          .eq("id", pending.id)
          .maybeSingle();
        return data ? null : true; // truthy once the row is gone
      }, 120_000, 3000);
      log(
        "capture.save",
        Boolean(person) && /elena/i.test(person?.canonical_name ?? "") && Boolean(cleaned),
        person ? `forged "${person.canonical_name}" · card row cleaned=${Boolean(cleaned)}` : "person never appeared"
      );
    } else {
      log("capture.edit", false, "skipped — no pending capture");
      log("capture.save", false, "skipped — no pending capture");
    }

    // 9. "?" recall wires a conversation to the chat (same shared pipeline as web)
    await webhook(textMsg(CHAT_A, "Who teaches pilates?"));
    const convo = await waitFor(async () => {
      const { data } = await admin
        .from("telegram_links")
        .select("conversation_id")
        .eq("telegram_chat_id", CHAT_A)
        .maybeSingle();
      return data?.conversation_id ? data : null;
    }, 30_000);
    log("recall.conversation", Boolean(convo), convo ? `conversation ${short(convo.conversation_id, 12)}…` : "no conversation was attached");

    // 10. Unlinked chat: no rows, no crash
    const strangerStatus = await webhook(textMsg(CHAT_STRANGER, "Met someone today"));
    await sleep(2500);
    const { count: strangerRows } = await admin
      .from("telegram_captures")
      .select("*", { count: "exact", head: true })
      .in("user_id", [userA.id, userB.id]);
    // userA may legitimately have 0 rows now; the stranger must not create any new ones
    log("unlinked.ignored", strangerStatus === 200 && (strangerRows ?? 0) === 0, `→ ${strangerStatus} rows=${strangerRows}`);

    // 11. Isolation: user B links their own chat and their data stays theirs
    const mintB = await api(userB, "POST", "/api/telegram/link");
    const tokenB = (mintB.json?.url as string | undefined)?.split("start=")[1] ?? "";
    await webhook(textMsg(CHAT_B, `/start ${tokenB}`));
    const linkB = await waitFor(async () => {
      const { data } = await admin
        .from("telegram_links")
        .select("user_id")
        .eq("telegram_chat_id", CHAT_B)
        .maybeSingle();
      return data?.user_id === userB.id ? data : null;
    }, 15_000);
    const { count: bPersons } = await admin
      .from("persons")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userB.id);
    log(
      "isolation.users",
      Boolean(linkB) && (bPersons ?? 0) === 0,
      `chat B → ${userB.email} · B's registry empty=${(bPersons ?? 0) === 0} (Elena belongs only to A)`
    );

    // 12. Disconnect from the app removes the mapping
    const unlink = await api(userA, "DELETE", "/api/telegram/link");
    const { data: afterUnlink } = await admin
      .from("telegram_links")
      .select("user_id")
      .eq("telegram_chat_id", CHAT_A)
      .maybeSingle();
    log("link.disconnect", unlink.status === 200 && !afterUnlink, `→ ${unlink.status} row-gone=${!afterUnlink}`);
  } finally {
    // fake chats are keyed by run — remove any leftover link rows first
    await admin.from("telegram_links").delete().in("telegram_chat_id", [CHAT_A, CHAT_B, CHAT_STRANGER]);
    await cleanup(users);
  }

  const failures = results.filter((r) => !r.ok);
  console.log(`\nChecks: ${results.length - failures.length}/${results.length} passed`);
  console.log(failures.length ? "GATE F4 (telegram): FAILURES" : "\nGATE F4 (telegram): GREEN");
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error("aborted:", e instanceof Error ? e.message : e);
  process.exit(1);
});
