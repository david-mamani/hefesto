import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProvisioned } from "@/memory/provisioning";
import { recall } from "@/lib/cognee";
import { buildBriefing } from "@/lib/groq";
import { warmthOf } from "@/lib/warmth";

/*
 * Pre-meeting briefing (Figma M12): a person-scoped recall structured by Groq
 * into {title, summary, keyPoints}. Shared by the web route and the Telegram
 * /briefing command. Grounded only in the user's own memories.
 */

export type BriefingResult = {
  personId: string;
  name: string;
  initial: string;
  cluster: "work" | "personal" | "family" | null;
  gap: string;
  title: string;
  summary: string;
  keyPoints: string[];
};

export class PersonNotFoundError extends Error {
  constructor() {
    super("Person not found");
  }
}

export async function personBriefing(userId: string, personId: string): Promise<BriefingResult> {
  const admin = createAdminClient();
  const { data: person } = await admin
    .from("persons")
    .select("person_id, canonical_name, cluster, last_interaction")
    .eq("user_id", userId)
    .eq("person_id", personId)
    .maybeSingle();
  if (!person) throw new PersonNotFoundError();

  const memory = await ensureProvisioned(userId);
  const raw = await recall({
    query: `Everything I know about ${person.canonical_name}: personal details (family, pets, hobbies, health), their work and role, how we know each other, their current situation, and anything I promised them or they asked for. List the concrete facts.`,
    searchType: "GRAPH_COMPLETION",
    datasets: [memory.datasetName],
    includeReferences: false,
  });
  const context = Array.isArray(raw)
    ? String((raw[0] as { text?: string })?.text ?? "")
    : String(raw ?? "");

  const briefing = await buildBriefing(person.canonical_name, context);
  const warmth = warmthOf(person.last_interaction);

  return {
    personId: person.person_id,
    name: person.canonical_name,
    initial: (person.canonical_name?.trim()?.[0] ?? "?").toUpperCase(),
    cluster: person.cluster as BriefingResult["cluster"],
    gap: warmth.gap,
    title: briefing.title,
    summary: briefing.summary,
    keyPoints: briefing.keyPoints,
  };
}
