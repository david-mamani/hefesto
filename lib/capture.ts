import type { ExtractedCapture } from "@/lib/groq";

export const ONTOLOGY_KEY = "hefesto_relationships_v1";

export type ConfirmedFields = {
  name: string;
  cluster: "work" | "personal" | "family";
  role: string | null;
  company: string | null;
  interests: string[];
  metAtEvent: string | null;
  metAtDate: string | null;
  relationship: string | null;
  facts: string[];
  commitments: string[];
};

/*
 * Every capture (typed text and, later, voice transcripts) is wrapped as a
 * markdown blob and ingested via remember multipart — the only path that
 * carries the ontology. The canonical name leads the document so entity
 * extraction anchors on it.
 */
export function buildCaptureMarkdown(input: {
  canonicalName: string;
  fields: ConfirmedFields;
  sourceText: string;
  channel: "web" | "telegram";
  capturedAt: Date;
}): string {
  const { canonicalName, fields, sourceText, channel, capturedAt } = input;
  const lines: string[] = [`# ${canonicalName}`, ""];

  if (fields.role || fields.company) {
    lines.push(`${canonicalName} is ${[fields.role, fields.company ? `at ${fields.company}` : null].filter(Boolean).join(" ")}.`);
  }
  if (fields.relationship) lines.push(`Relationship: ${fields.relationship}.`);
  if (fields.metAtEvent || fields.metAtDate) {
    lines.push(
      `Met at ${fields.metAtEvent ?? "an event"}${fields.metAtDate ? ` on ${fields.metAtDate}` : ""}.`
    );
  }
  if (fields.interests.length) lines.push(`Interests: ${fields.interests.join(", ")}.`);
  for (const fact of fields.facts) lines.push(`${fact}.`.replace(/\.\.$/, "."));
  for (const commitment of fields.commitments)
    lines.push(`${canonicalName} ${commitment}.`.replace(/\.\.$/, "."));

  lines.push("", `Original note (${channel}, ${capturedAt.toISOString()}):`, `"${sourceText}"`);
  return lines.join("\n");
}

export function extractionToFields(extraction: ExtractedCapture): ConfirmedFields {
  return {
    name: extraction.name ?? "",
    cluster: extraction.cluster,
    role: extraction.role,
    company: extraction.company,
    interests: extraction.interests,
    metAtEvent: extraction.met_at.event,
    metAtDate: extraction.met_at.date,
    relationship: extraction.relationship,
    facts: extraction.facts,
    commitments: extraction.commitments,
  };
}
