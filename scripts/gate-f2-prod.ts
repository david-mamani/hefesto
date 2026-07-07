/* F2 gate checks against production, as the seeded demo account.
 * Signs in via an admin-generated magic link (no password needed), then walks
 * the phase checklist: graph + warmth, Home nudge, thought-path recall, People.
 * Read-only for the demo account — forget is covered by gate-e2e's own users.
 *
 * Run from app/:  npx tsx scripts/gate-f2-prod.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type Session } from "@supabase/supabase-js";

const BASE = "https://hefesto.org";
const DEMO_EMAIL = "demo@hefesto.org";

const here = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(here, "..", ".env.local"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const eq = line.indexOf("=");
  if (eq <= 0 || line.trimStart().startsWith("#")) continue;
  const key = line.slice(0, eq).trim();
  if (key && !(key in process.env)) process.env[key] = line.slice(eq + 1).trim();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;
const CHUNK = 3180;

const results: { step: string; ok: boolean; note: string }[] = [];
function log(step: string, ok: boolean, note: string) {
  results.push({ step, ok, note });
  console.log(`${ok ? "✔" : "✘"} [${step}] ${note}`);
}
const short = (v: unknown, m = 160) => {
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

async function main() {
  console.log(`— Hefesto · F2 gate against ${BASE} (demo account) —\n`);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: DEMO_EMAIL,
  });
  if (linkError || !linkData.properties?.hashed_token) {
    throw new Error(`generateLink failed: ${linkError?.message}`);
  }
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyError || !verified.session) throw new Error(`verifyOtp failed: ${verifyError?.message}`);
  const cookie = cookieOf(verified.session);
  console.log(`signed in as ${DEMO_EMAIL}\n`);

  const page = async (path: string, mobile: boolean) => {
    const res = await fetch(`${BASE}${path}`, {
      headers: { cookie, "sec-ch-ua-mobile": mobile ? "?1" : "?0" },
    });
    return { status: res.status, html: await res.text() };
  };
  const api = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json };
  };

  // 1. Mobile Home: cold-contact nudge speaks (Jorge, 2 months)
  const home = await page("/", true);
  const nudgeShown = /going cold|Reconnect with Jorge/i.test(home.html);
  log("home.nudge", home.status === 200 && nudgeShown, `→ ${home.status} nudge-copy=${nudgeShown}`);

  // 2. Mobile graph: all six seeded people + warmth/mode legend
  const graph = await page("/graph", true);
  const names = ["Ana", "Leo", "Carlos", "Sofía", "Mom", "Jorge"];
  const missing = names.filter((n) => !graph.html.includes(n));
  const legend = /GLOW = MODE|glow = mode/i.test(graph.html) || /node = warmth/i.test(graph.html);
  log(
    "graph.mobile",
    graph.status === 200 && missing.length === 0 && legend,
    `→ ${graph.status} missing=[${missing.join(",")}] legend=${legend}`
  );

  // 3. Desktop graph (M10c): selected panel + filters
  const dgraph = await page("/graph", false);
  const dOk =
    dgraph.status === 200 &&
    /Selected|SELECTED/.test(dgraph.html) &&
    /Warmth ·|WARMTH ·/i.test(dgraph.html) &&
    /Warm → cold|WARM → COLD/i.test(dgraph.html);
  log("graph.desktop", dOk, `→ ${dgraph.status} panel+legend=${dOk}`);

  // 4. Desktop Home (M10): live stats + network widget
  const dhome = await page("/", false);
  const statsOk =
    dhome.status === 200 &&
    /in your memory/.test(dhome.html) &&
    /Your network|YOUR NETWORK/i.test(dhome.html) &&
    /Memory health|MEMORY HEALTH/i.test(dhome.html);
  log("home.desktop", statsOk, `→ ${dhome.status} stats+widget=${statsOk}`);

  // 5. People (M06 mobile + M10b desktop) and the person card
  const people = await page("/people", true);
  const peopleOk = people.status === 200 && names.every((n) => people.html.includes(n));
  log("people.mobile", peopleOk, `→ ${people.status} all-six=${peopleOk}`);

  const dpeople = await page("/people", false);
  const dPeopleOk =
    dpeople.status === 200 &&
    /AFFINITY|Affinity/i.test(dpeople.html) &&
    /What I know|WHAT I KNOW/i.test(dpeople.html) &&
    /Forget person/.test(dpeople.html);
  log("people.desktop", dPeopleOk, `→ ${dpeople.status} card-panel=${dPeopleOk}`);

  // 6. Multi-hop recall with a visible path (the demo question)
  const chat = await api("POST", "/api/chat", {
    message: "Who can introduce me to someone who runs a gaming studio?",
  });
  const pathNames = (chat.json?.path ?? []).map((p: { name: string }) => p.name).join("→");
  const pathOk =
    chat.status === 200 &&
    (chat.json?.path?.length ?? 0) >= 1 &&
    /leo/i.test(chat.json?.text ?? "") &&
    /maya/i.test(chat.json?.text ?? "");
  log(
    "chat.path",
    pathOk,
    `→ ${chat.status} path=[${pathNames}] qaId=${chat.json?.qaId ? "yes" : "no"} text=${short(chat.json?.text, 90)}`
  );

  // 7. Nudge endpoint on-open
  const nudge = await api("POST", "/api/nudge");
  log("api.nudge", nudge.status === 200, `→ ${nudge.status} ${short(nudge.json, 120)}`);

  // 8. Briefing for the featured person
  const { data: ana } = await admin
    .from("persons")
    .select("person_id, user_id")
    .eq("canonical_name", "Ana García")
    .eq("user_id", verified.session.user.id)
    .maybeSingle();
  if (ana) {
    const briefing = await api("GET", `/api/briefing?personId=${ana.person_id}`);
    log(
      "api.briefing",
      briefing.status === 200 && Boolean(briefing.json?.summary),
      `→ ${briefing.status} keyPoints=${briefing.json?.keyPoints?.length ?? 0} summary=${short(briefing.json?.summary, 80)}`
    );
  } else {
    log("api.briefing", false, "Ana García not found in demo registry");
  }

  const failures = results.filter((r) => !r.ok);
  console.log(`\nChecks: ${results.length - failures.length}/${results.length} passed`);
  console.log(failures.length ? "GATE F2: FAILURES" : "\nGATE F2: GREEN");
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error("aborted:", e instanceof Error ? e.message : e);
  process.exit(1);
});
