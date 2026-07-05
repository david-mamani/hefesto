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
