/*
 * Relationship warmth — a contact "cools" the longer it's been since you last
 * interacted. Model (PRD §17.1.5):
 *
 *     warmth = round(100 · exp(-days_since_last_interaction / 30))
 *
 *   WARM    ≥ 70   (≲ 11 days)   full ember
 *   COOLING 30–69                fading
 *   COLD    < 30   (≳ 36 days)   grey
 *
 * The ember/node color rides a continuous orange→grey ramp so the graph and the
 * "Your network" widget read as temperature at a glance.
 */

export type WarmthBand = "warm" | "cooling" | "cold";

export type Warmth = {
  score: number; // 0–100
  band: WarmthBand;
  days: number; // whole days since last interaction (Infinity if never)
  color: string; // hex on the orange→grey ramp
  gap: string; // human gap: "today", "3 days", "2 weeks", "2 months"
};

const HALF_LIFE_DAYS = 30;
const WARM_MIN = 70;
const COOLING_MIN = 30;
const MS_PER_DAY = 86_400_000;

// Ramp endpoints are design tokens: warm --orange, cold --muted grey.
const WARM_RGB = [0xf0, 0x7e, 0x12];
const COLD_RGB = [0x96, 0x89, 0x7a];

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

export function warmthColor(score: number): string {
  const t = Math.min(1, Math.max(0, score / 100));
  const rgb = WARM_RGB.map((warm, i) => lerp(COLD_RGB[i], warm, t));
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function bandFor(score: number): WarmthBand {
  if (score >= WARM_MIN) return "warm";
  if (score >= COOLING_MIN) return "cooling";
  return "cold";
}

export function humanizeGap(days: number): string {
  if (!isFinite(days)) return "never";
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 14) return `${Math.round(days)} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30);
  return `${months} ${months === 1 ? "month" : "months"}`;
}

export function warmthOf(
  lastInteraction: Date | string | null,
  now: Date = new Date()
): Warmth {
  if (!lastInteraction) {
    return { score: 0, band: "cold", days: Infinity, color: warmthColor(0), gap: "never" };
  }
  const last =
    typeof lastInteraction === "string" ? new Date(lastInteraction) : lastInteraction;
  const days = Math.max(0, (now.getTime() - last.getTime()) / MS_PER_DAY);
  const score = Math.round(100 * Math.exp(-days / HALF_LIFE_DAYS));
  return { score, band: bandFor(score), days, color: warmthColor(score), gap: humanizeGap(days) };
}

/*
 * Retroactive warmth series — warmth is a pure function of last_interaction, so
 * the last N days can be reconstructed without stored history: at a past day t,
 * a person contributes exp-decay from their last interaction BEFORE t (0 if we
 * only met them afterwards). Feeds the "Network warmth · last 30 days" chart.
 */
export function warmthSeries(
  people: { lastInteraction: string | null; createdAt?: string | null }[],
  days = 30,
  now: Date = new Date()
): number[] {
  const series: number[] = [];
  for (let back = days - 1; back >= 0; back--) {
    const t = now.getTime() - back * MS_PER_DAY;
    let sum = 0;
    let count = 0;
    for (const person of people) {
      const created = person.createdAt ? new Date(person.createdAt).getTime() : null;
      if (created !== null && created > t) continue; // didn't exist yet
      count++;
      const li = person.lastInteraction ? new Date(person.lastInteraction).getTime() : null;
      if (li === null || li > t) continue; // no interaction before t → cold
      sum += 100 * Math.exp(-((t - li) / MS_PER_DAY) / HALF_LIFE_DAYS);
    }
    series.push(count === 0 ? 0 : Math.round(sum / count));
  }
  return series;
}

// ---------- Nudge selection ----------

export type NudgeCandidate = {
  personId: string;
  name: string;
  cluster: "work" | "personal" | "family" | null;
  lastInteraction: string | null;
  lastNudgeAt: string | null;
};

export type Nudge = {
  personId: string;
  name: string;
  cluster: NudgeCandidate["cluster"];
  warmth: Warmth;
  message: string;
};

// Don't re-nudge the same person within this window (PRD §17.1.5).
const NUDGE_COOLDOWN_DAYS = 7;

function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}

/*
 * Pick the single coldest contact worth reconnecting with: in the COLD band
 * (warmth < 30, PRD §17.1.5) and not nudged within the cooldown. Returns null
 * when nobody has gone cold.
 */
export function selectNudge(
  candidates: NudgeCandidate[],
  now: Date = new Date()
): Nudge | null {
  let best: Nudge | null = null;
  for (const candidate of candidates) {
    const warmth = warmthOf(candidate.lastInteraction, now);
    if (warmth.band !== "cold") continue;
    if (candidate.lastNudgeAt) {
      const sinceNudge =
        (now.getTime() - new Date(candidate.lastNudgeAt).getTime()) / MS_PER_DAY;
      if (sinceNudge < NUDGE_COOLDOWN_DAYS) continue;
    }
    if (!best || warmth.score < best.warmth.score) {
      best = {
        personId: candidate.personId,
        name: candidate.name,
        cluster: candidate.cluster,
        warmth,
        message: `${firstName(candidate.name)} is going cold — ${warmth.gap}. Forge a reconnection?`,
      };
    }
  }
  return best;
}
