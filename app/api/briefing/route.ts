import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProvisioned } from "@/memory/provisioning";
import { recall } from "@/lib/cognee";
import { buildBriefing } from "@/lib/groq";
import { warmthOf } from "@/lib/warmth";

/*
 * Pre-meeting briefing (Figma M12): a person-scoped GRAPH_SUMMARY_COMPLETION,
 * structured by Groq into {title, summary, key_points}. Grounded only in the
 * user's own memories.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const personId = new URL(request.url).searchParams.get("personId");
  if (!personId) return NextResponse.json({ error: "Missing personId" }, { status: 400 });

  try {
    const admin = createAdminClient();
    const { data: person } = await admin
      .from("persons")
      .select("person_id, canonical_name, cluster, last_interaction")
      .eq("user_id", user.id)
      .eq("person_id", personId)
      .maybeSingle();
    if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

    const memory = await ensureProvisioned(user.id);
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

    return NextResponse.json({
      personId: person.person_id,
      name: person.canonical_name,
      initial: (person.canonical_name?.trim()?.[0] ?? "?").toUpperCase(),
      cluster: person.cluster,
      gap: warmth.gap,
      title: briefing.title,
      summary: briefing.summary,
      keyPoints: briefing.keyPoints,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Briefing failed" },
      { status: 500 }
    );
  }
}
