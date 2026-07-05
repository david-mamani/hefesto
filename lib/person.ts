import type { NetworkPerson } from "@/lib/network";

/*
 * Pure presentation helpers for a person's profile — safe to import from client
 * components (lib/network.ts is server-only because of the admin client).
 */

/*
 * "What you know" — short knowledge lines for the selected-node panel and the
 * person card: role@company first, then interests, facts, and commitments.
 */
export function knowledgeLines(person: NetworkPerson, max = 5): string[] {
  const lines: string[] = [];
  if (person.role && person.company) lines.push(`${person.role} at ${person.company}`);
  else if (person.role) lines.push(person.role);
  else if (person.company) lines.push(`Works at ${person.company}`);
  if (person.interests.length) lines.push(`Into ${person.interests.slice(0, 3).join(", ")}`);
  lines.push(...person.facts);
  lines.push(...person.commitments);
  return lines.slice(0, max);
}

/* "3 days" → "last interaction: 3 days ago" (gap grammar from warmth.humanizeGap). */
export function lastInteractionLine(gap: string): string {
  if (gap === "never") return "no interactions yet";
  if (gap === "today" || gap === "yesterday") return `last interaction: ${gap}`;
  return `last interaction: ${gap} ago`;
}

/* Compact recency for list rows (M06/M10b): today · 3d · 2w · 1m. */
export function compactGap(days: number): string {
  if (!isFinite(days)) return "new";
  if (days < 1) return "today";
  if (days < 14) return `${Math.max(1, Math.round(days))}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}m`;
}

/* Affinity card caption by warmth band (M07 copy for the mid band). */
export function affinityCaption(band: "warm" | "cooling" | "cold"): string {
  if (band === "warm") return "burning bright";
  if (band === "cooling") return "getting closer";
  return "going cold";
}

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/* List-row subtitle (M06/M10b): "Designer · likes hiking", "Family · call Sundays". */
export function subtitleFor(person: NetworkPerson): string {
  const primary = person.role ?? (person.relationship ? titleCase(person.relationship) : null) ??
    (person.cluster ? titleCase(person.cluster) : null);
  const secondary =
    person.company ??
    (person.interests[0] ? `likes ${person.interests[0]}` : null) ??
    person.facts[0] ??
    person.commitments[0];
  return [primary, secondary].filter(Boolean).join(" · ");
}

/* Header subtitle for the person card: "Designer at Studio X" / relationship. */
export function personTitle(person: NetworkPerson): string {
  if (person.role && person.company) return `${person.role} at ${person.company}`;
  if (person.role) return person.role;
  if (person.company) return `Works at ${person.company}`;
  if (person.relationship) return titleCase(person.relationship);
  return person.cluster ? titleCase(person.cluster) : "";
}
