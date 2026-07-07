/* F3 gate checks against production, as the seeded demo account.
 * Covers everything automatable of the phase: the mascot clip set being
 * served, the settings screens, dark-theme SSR, the briefing data and the
 * voice route surface. Animation feel, voice e2e and mode tint are the
 * real-phone checklist.
 *
 * Run from app/:  npx tsx scripts/gate-f3-prod.ts
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
  console.log(`— Hefesto · F3 gate against ${BASE} (demo account) —\n`);

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
  if (linkError || !linkData.properties?.hashed_token) throw new Error(`generateLink: ${linkError?.message}`);
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyError || !verified.session) throw new Error(`verifyOtp: ${verifyError?.message}`);
  const auth = cookieOf(verified.session);
  console.log(`signed in as ${DEMO_EMAIL}\n`);

  const page = async (path: string, opts: { mobile?: boolean; extraCookie?: string } = {}) => {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        cookie: auth + (opts.extraCookie ? `; ${opts.extraCookie}` : ""),
        "sec-ch-ua-mobile": opts.mobile ? "?1" : "?0",
      },
    });
    return { status: res.status, html: await res.text() };
  };

  // 1. The full clip set is served
  const manifest = await fetch(`${BASE}/mascot/manifest.json`).then((r) => r.json());
  const clips: string[] = manifest.clips ?? [];
  const EXPECTED = ["idle", "blink", "tail", "doubt", "typing", "listening", "alert"];
  const missing = EXPECTED.filter((c) => !clips.includes(c));
  log("mascot.manifest", missing.length === 0, `clips=[${clips.join(",")}] missing=[${missing.join(",")}]`);

  // 2. The idle carries the approved frames + timing
  const idle = await fetch(`${BASE}/mascot/idle.json`).then((r) => r.json());
  const seq = (idle.sequence ?? []).map((s: { ms: number }) => s.ms).join("/");
  const idleOk = idle.frames?.length === 4 && seq === "200/2000/200/2000";
  log("mascot.idle", idleOk, `frames=${idle.frames?.length} holds=${seq}`);

  const blink = await fetch(`${BASE}/mascot/blink.json`).then((r) => r.json());
  const tail = await fetch(`${BASE}/mascot/tail.json`).then((r) => r.json());
  log(
    "mascot.gestures",
    blink.sequence?.[0]?.ms === 70 && tail.variants?.length === 5 && blink.anchor === 1,
    `blink=${blink.sequence?.[0]?.ms}ms anchored=${blink.anchor === 1} tailVariants=${tail.variants?.length}`
  );

  // 3. Account (mobile) + Settings (desktop)
  const account = await page("/account", { mobile: true });
  const accountOk =
    account.status === 200 &&
    /Appearance/.test(account.html) &&
    /Proactive nudges/.test(account.html) &&
    /Log out/.test(account.html) &&
    /Connect Telegram/.test(account.html);
  log("screens.account", accountOk, `→ ${account.status} rows+toggle+logout=${accountOk}`);

  const settings = await page("/settings", { mobile: false });
  const settingsOk =
    settings.status === 200 &&
    /account · connections · privacy/.test(settings.html) &&
    /Connect Telegram/.test(settings.html) &&
    /Forget everything/.test(settings.html) &&
    /Member since/i.test(settings.html);
  log("screens.settings", settingsOk, `→ ${settings.status} m10e-blocks=${settingsOk}`);

  // 4. Dark theme is SSR'd from the cookie (no-flash requirement)
  const dark = await page("/", { mobile: true, extraCookie: "theme=dark" });
  const darkOk = dark.status === 200 && /data-theme="dark"/.test(dark.html);
  const light = await page("/", { mobile: true });
  const lightOk = light.status === 200 && !/data-theme="dark"/.test(light.html);
  log("theme.ssr", darkOk && lightOk, `dark-cookie→data-theme ${darkOk} · default light ${lightOk}`);

  // 5. Briefing data for Ana (M12)
  const { data: ana } = await admin
    .from("persons")
    .select("person_id")
    .eq("canonical_name", "Ana García")
    .eq("user_id", verified.session.user.id)
    .maybeSingle();
  if (ana) {
    const res = await fetch(`${BASE}/api/briefing?personId=${ana.person_id}`, {
      headers: { cookie: auth },
    });
    const briefing = await res.json();
    log(
      "briefing.ana",
      res.status === 200 && Boolean(briefing.summary) && (briefing.keyPoints?.length ?? 0) > 0,
      `→ ${res.status} keyPoints=${briefing.keyPoints?.length ?? 0}`
    );
  } else {
    log("briefing.ana", false, "Ana García not found");
  }

  // 6. Voice route is deployed (full e2e is the phone checklist)
  const voice = await fetch(`${BASE}/api/capture/voice`, {
    method: "POST",
    headers: { cookie: auth },
    body: new FormData(),
  });
  const voiceBody = await voice.json().catch(() => ({}));
  log("voice.surface", voice.status === 400, `→ ${voice.status} ${JSON.stringify(voiceBody).slice(0, 60)}`);

  const failures = results.filter((r) => !r.ok);
  console.log(`\nChecks: ${results.length - failures.length}/${results.length} passed`);
  console.log(failures.length ? "GATE F3 (auto): FAILURES" : "\nGATE F3 (auto): GREEN");
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error("aborted:", e instanceof Error ? e.message : e);
  process.exit(1);
});
