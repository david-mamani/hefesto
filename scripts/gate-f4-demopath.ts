/*
 * F4 final gate — the FULL demo path (PRD §8), timed, run twice with fresh
 * data: signup → connect Telegram (deep-link handshake) → capture through the
 * bot → confirm → graph → multi-hop recall with a walked path → mode change
 * (Ana vs Carlos) → warmth/nudge → thumbs-down feedback → forget → clean.
 *
 * Telegram voice specifically needs a real chat (Telegram serves the file) —
 * that beat lives on the phone checklist; here the bot leg runs on text.
 *
 * Run from app/:
 *   npx tsx scripts/gate-f4-demopath.ts                  # against production, 2 runs
 *   npx tsx scripts/gate-f4-demopath.ts --runs 1
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

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { datasets } from "../lib/cognee";

const BASE = (() => {
  const i = process.argv.indexOf("--base");
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : "https://hefesto.org";
})();
const RUNS = (() => {
  const i = process.argv.indexOf("--runs");
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : 2;
})();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !WEBHOOK_SECRET) {
  console.error("Missing env (Supabase keys / TELEGRAM_WEBHOOK_SECRET)");
  process.exit(1);
}

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;
const CHUNK = 3180;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const short = (v: unknown, m = 120) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s && s.length > m ? `${s.slice(0, m)}…` : s ?? "";
};

function cookieOf(session: Session): string {
  const encoded = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  if (encoded.length <= CHUNK) return `${COOKIE_NAME}=${encoded}`;
  const parts: string[] = [];
  for (let i = 0; i * CHUNK < encoded.length; i++) {
    parts.push(`${COOKIE_NAME}.${i}=${encoded.slice(i * CHUNK, (i + 1) * CHUNK)}`);
  }
  return parts.join("; ");
}

async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, timeoutMs: number, stepMs = 2500): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value as T;
    if (Date.now() > deadline) return null;
    await sleep(stepMs);
  }
}

type Check = { step: string; ok: boolean; ms: number; note: string };

class Journey {
  checks: Check[] = [];
  cookie = "";
  userId = "";
  email = "";
  chatId: number;
  anon: SupabaseClient;

  constructor(run: number) {
    this.chatId = -(Date.now() % 1_000_000_000) - 2_000_000_000 - run;
    this.anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  log(step: string, ok: boolean, ms: number, note: string) {
    this.checks.push({ step, ok, ms, note });
    console.log(`${ok ? "✔" : "✘"} [${step}] ${(ms / 1000).toFixed(1)}s · ${note}`);
  }

  async timed<T>(step: string, fn: () => Promise<{ ok: boolean; note: string; value?: T }>): Promise<T | undefined> {
    const t0 = Date.now();
    try {
      const { ok, note, value } = await fn();
      this.log(step, ok, Date.now() - t0, note);
      return value;
    } catch (e) {
      this.log(step, false, Date.now() - t0, `threw: ${short((e as Error).message)}`);
      return undefined;
    }
  }

  async api(method: string, path: string, body?: unknown) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { cookie: this.cookie, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json };
  }

  async webhook(update: unknown) {
    return fetch(`${BASE}/api/telegram`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": WEBHOOK_SECRET! },
      body: JSON.stringify(update),
    }).then((r) => r.status);
  }

  tgText(text: string) {
    return { message: { chat: { id: this.chatId }, text } };
  }

  tgCallback(data: string) {
    return { callback_query: { id: `cb-${Date.now()}`, data, message: { chat: { id: this.chatId }, message_id: 1 } } };
  }

  /** Web capture → confirm → forge, timed as one demo beat. */
  async webCapture(step: string, sourceText: string, fallbackName: string, fallbackCluster: string) {
    return this.timed<string>(step, async () => {
      const cap = await this.api("POST", "/api/capture", { text: sourceText });
      const x = cap.json?.extraction;
      if (cap.status !== 200 || !x) return { ok: false, note: `extract → ${cap.status}` };
      const confirm = await this.api("POST", "/api/capture/confirm", {
        resolution: "new",
        fields: {
          name: x.name ?? fallbackName,
          cluster: x.cluster ?? fallbackCluster,
          role: x.role ?? null,
          company: x.company ?? null,
          interests: x.interests ?? [],
          metAtEvent: x.met_at?.event ?? null,
          metAtDate: x.met_at?.date ?? null,
          relationship: x.relationship ?? null,
          facts: x.facts ?? [],
          commitments: x.commitments ?? [],
        },
        sourceText,
        channel: "web",
      });
      const { personId, filename } = confirm.json ?? {};
      if (!personId || !filename) return { ok: false, note: `confirm → ${confirm.status} ${short(confirm.json)}` };
      let status = "";
      const done = await waitFor(async () => {
        const s = await this.api(
          "GET",
          `/api/capture/status?filename=${encodeURIComponent(filename)}&personId=${personId}`
        );
        status = s.json?.status ?? `http ${s.status}`;
        if (status === "failed") return false;
        return status === "completed" ? true : null;
      }, 180_000, 3000);
      return {
        ok: Boolean(done),
        note: done ? `"${x.name ?? fallbackName}" forged` : `forge status="${status}"`,
        value: personId as string,
      };
    });
  }

  green() {
    return this.checks.every((c) => c.ok);
  }
}

async function runJourney(run: number): Promise<Journey> {
  const j = new Journey(run);
  console.log(`\n———— RUN ${run} ————`);

  // 1. Fresh signup, exactly like the login screen does it
  await j.timed("signup", async () => {
    j.email = `gate.demo${run}.${Date.now()}@hefesto.org`;
    const password = randomBytes(18).toString("base64url");
    const { data, error } = await j.anon.auth.signUp({ email: j.email, password });
    if (error || !data.session) return { ok: false, note: `signUp: ${error?.message}` };
    j.userId = data.user!.id;
    j.cookie = cookieOf(data.session);
    const provision = await j.api("POST", "/api/provision");
    return {
      ok: provision.status === 200,
      note: `${j.email} → provision ${provision.status}`,
    };
  });
  if (!j.userId) return j;

  try {
    // 2. Connect Telegram via the deep-link handshake
    await j.timed("telegram.connect", async () => {
      const mint = await j.api("POST", "/api/telegram/link");
      const token = (mint.json?.url as string | undefined)?.split("start=")[1];
      if (!token) return { ok: false, note: `mint → ${mint.status} ${short(mint.json)}` };
      await j.webhook(j.tgText(`/start ${token}`));
      const linked = await waitFor(async () => {
        const { data } = await admin
          .from("telegram_links")
          .select("user_id")
          .eq("telegram_chat_id", j.chatId)
          .maybeSingle();
        return data?.user_id === j.userId ? data : null;
      }, 15_000, 1500);
      return { ok: Boolean(linked), note: linked ? "chat linked via one-time token" : "handshake never landed" };
    });

    // 3. Capture through the bot → inline confirm → forge → graph registry
    const carlosId = await j.timed<string>("capture.telegram", async () => {
      await j.webhook(
        j.tgText(
          "Met Carlos Vega at the afterparty, fintech founder, two kids, into trail running, wants an intro to a designer"
        )
      );
      const pending = await waitFor(async () => {
        const { data } = await admin
          .from("telegram_captures")
          .select("id")
          .eq("user_id", j.userId)
          .maybeSingle();
        return data ?? null;
      }, 25_000, 2000);
      if (!pending) return { ok: false, note: "no confirmation card row" };
      await j.webhook(j.tgCallback(`save:${pending.id}`));
      const person = await waitFor(async () => {
        const { data } = await admin
          .from("persons")
          .select("person_id, canonical_name")
          .eq("user_id", j.userId)
          .maybeSingle();
        return data ?? null;
      }, 150_000, 3000);
      const cleaned = await waitFor(async () => {
        const { data } = await admin.from("telegram_captures").select("id").eq("id", pending.id).maybeSingle();
        return data ? null : true;
      }, 150_000, 3000);
      return {
        ok: Boolean(person) && /carlos/i.test(person?.canonical_name ?? "") && Boolean(cleaned),
        note: person ? `"${person.canonical_name}" forged via bot · card cleaned=${Boolean(cleaned)}` : "person never appeared",
        value: person?.person_id as string,
      };
    });

    // 4. Two more captures from the web composer (the multi-hop + mode cast)
    await j.webCapture(
      "capture.web.leo",
      "Leo Park is a game designer at PixelForge. He knows Maya Chen personally — she runs Ember Works, a gaming studio.",
      "Leo Park",
      "work"
    );
    await j.webCapture(
      "capture.web.ana",
      "Had coffee with Ana García, a close friend. Her dog Toby was sick but is better now. She runs a small design studio and is hiring a designer.",
      "Ana García",
      "personal"
    );

    // 5. The graph holds the whole cast
    await j.timed("graph", async () => {
      const { data: row } = await admin
        .from("users_cognee")
        .select("dataset_id")
        .eq("user_id", j.userId)
        .maybeSingle();
      if (!row?.dataset_id) return { ok: false, note: "no dataset row" };
      const graph = await datasets.graph(row.dataset_id).catch(() => ({ nodes: [], edges: [] }));
      const labels = graph.nodes.map((n: { label?: string }) => String(n.label ?? "").toLowerCase());
      const cast = ["carlos", "leo", "ana"].filter((n) => labels.some((l) => l.includes(n)));
      return {
        ok: cast.length === 3,
        note: `nodes=${graph.nodes.length} edges=${graph.edges.length} cast=[${cast.join(",")}]`,
      };
    });

    // 6. Multi-hop with a visible walked path
    const multihop = await j.timed<{ qaId: string; sessionId: string }>("recall.multihop", async () => {
      const chat = await j.api("POST", "/api/chat", {
        message: "Who can introduce me to someone who runs a gaming studio?",
      });
      const text = chat.json?.text ?? "";
      const ok =
        chat.status === 200 &&
        !chat.json?.pending &&
        /leo/i.test(text) &&
        /maya/i.test(text) &&
        (chat.json?.path?.length ?? 0) >= 1;
      return {
        ok,
        note: `path=[${(chat.json?.path ?? []).map((p: { name: string }) => p.name).join("→")}] text=${short(text, 90)}`,
        value: chat.json?.qaId && chat.json?.sessionId ? { qaId: chat.json.qaId, sessionId: chat.json.sessionId } : undefined,
      };
    });

    // 7. Mode change: the same question about Ana vs Carlos flips the mascot mode
    await j.timed("mode.change", async () => {
      const ana = await j.api("POST", "/api/chat", { message: "What should I talk about with Ana?" });
      const carlos = await j.api("POST", "/api/chat", { message: "What should I talk about with Carlos?" });
      const ok =
        ana.status === 200 &&
        carlos.status === 200 &&
        ana.json?.mode === "personal" &&
        carlos.json?.mode === "networking";
      return { ok, note: `Ana→${ana.json?.mode} · Carlos→${carlos.json?.mode}` };
    });

    // 8. Warmth cools → the on-open nudge speaks (Carlos backdated 60 days)
    await j.timed("nudge", async () => {
      if (!carlosId) return { ok: false, note: "no Carlos to cool down" };
      await admin
        .from("persons")
        .update({ last_interaction: new Date(Date.now() - 60 * 86_400_000).toISOString() })
        .eq("person_id", carlosId);
      const nudge = await j.api("POST", "/api/nudge");
      const name = nudge.json?.nudge?.name ?? "";
      return {
        ok: nudge.status === 200 && /carlos/i.test(name),
        note: `→ ${nudge.status} nudge="${short(nudge.json?.nudge?.message ?? name, 80)}"`,
      };
    });

    // 9. Thumbs-down → FeedbackEntry chained to the qa_id (the honest improve loop)
    await j.timed("feedback.down", async () => {
      if (!multihop) return { ok: false, note: "no qaId from the multi-hop answer" };
      const fb = await j.api("POST", "/api/feedback", { ...multihop, thumbs: "down" });
      return { ok: fb.status === 200 && fb.json?.ok === true, note: `→ ${fb.status} ${short(fb.json)}` };
    });

    // 10. Forget Carlos — the graph and the registry both let go
    await j.timed("forget", async () => {
      if (!carlosId) return { ok: false, note: "no Carlos to forget" };
      const forget = await j.api("POST", "/api/forget", { personId: carlosId });
      const { count } = await admin
        .from("persons")
        .select("*", { count: "exact", head: true })
        .eq("user_id", j.userId);
      return {
        ok: forget.status === 200 && forget.json?.ok === true && (count ?? 0) === 2,
        note: `→ ${forget.status} forgot=${forget.json?.forgot} remaining persons=${count}`,
      };
    });
  } finally {
    // 11. Leave nothing behind
    const t0 = Date.now();
    try {
      await admin.from("telegram_links").delete().eq("telegram_chat_id", j.chatId);
      const { data: row } = await admin
        .from("users_cognee")
        .select("dataset_id, dataset_name")
        .eq("user_id", j.userId)
        .maybeSingle();
      const { data: persons } = await admin.from("persons").select("person_id").eq("user_id", j.userId);
      const ids = (persons ?? []).map((p) => p.person_id);
      if (ids.length) await admin.from("person_data").delete().in("person_id", ids);
      for (const table of ["capture_notes", "telegram_captures", "link_tokens", "conversations", "persons", "users_cognee"]) {
        await admin.from(table).delete().eq("user_id", j.userId);
      }
      if (row?.dataset_id) await datasets.delete(row.dataset_id).catch(() => undefined);
      await admin.auth.admin.deleteUser(j.userId);
      j.log("clean", true, Date.now() - t0, `${j.email} + dataset removed`);
    } catch (e) {
      j.log("clean", false, Date.now() - t0, short((e as Error).message));
    }
  }

  return j;
}

async function main() {
  console.log(`— Hefesto · F4 demo-path gate against ${BASE} · ${RUNS} run(s) —`);
  const journeys: Journey[] = [];
  for (let run = 1; run <= RUNS; run++) {
    journeys.push(await runJourney(run));
  }

  console.log("\n———— TIMINGS ————");
  const steps = journeys[0]?.checks.map((c) => c.step) ?? [];
  for (const step of steps) {
    const cells = journeys.map((jn) => {
      const c = jn.checks.find((x) => x.step === step);
      return c ? `${c.ok ? "✔" : "✘"} ${(c.ms / 1000).toFixed(1)}s` : "—";
    });
    console.log(`${step.padEnd(18)} ${cells.join("   ")}`);
  }

  const allGreen = journeys.length === RUNS && journeys.every((jn) => jn.green());
  const failed = journeys.flatMap((jn, i) =>
    jn.checks.filter((c) => !c.ok).map((c) => `run${i + 1}:${c.step}`)
  );
  console.log(
    `\nRuns: ${journeys.filter((jn) => jn.green()).length}/${RUNS} green${failed.length ? ` · failed: ${failed.join(", ")}` : ""}`
  );
  console.log(allGreen ? "\nGATE F4 (demo path): GREEN" : "GATE F4 (demo path): FAILURES");
  process.exit(allGreen ? 0 : 1);
}

main().catch((e) => {
  console.error("aborted:", e instanceof Error ? e.message : e);
  process.exit(1);
});
