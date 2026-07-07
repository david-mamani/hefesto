import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProvisioned } from "@/memory/provisioning";
import { recall } from "@/lib/cognee";
import { draftOpener } from "@/lib/groq";

/*
 * Draft message / Draft opener: a short reconnection text grounded ONLY in the
 * user's memories about that person (recall → Groq). Nothing is sent anywhere —
 * the user copies it into whatever app they actually message from.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { personId } = (await request.json().catch(() => ({}))) as { personId?: string };
  if (!personId) return NextResponse.json({ error: "Missing personId" }, { status: 400 });

  try {
    const admin = createAdminClient();
    const { data: person } = await admin
      .from("persons")
      .select("person_id, canonical_name")
      .eq("user_id", user.id)
      .eq("person_id", personId)
      .maybeSingle();
    if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

    const memory = await ensureProvisioned(user.id);
    const raw = await recall({
      query: `Everything I know about ${person.canonical_name}: their situation, what they care about, anything I promised them or they asked for, and how we know each other. List the concrete facts.`,
      searchType: "GRAPH_COMPLETION",
      datasets: [memory.datasetName],
      includeReferences: false,
    });
    const context = Array.isArray(raw)
      ? String((raw[0] as { text?: string })?.text ?? "")
      : String(raw ?? "");

    const text = await draftOpener(person.canonical_name, context);
    if (!text) throw new Error("Empty draft");

    return NextResponse.json({ name: person.canonical_name, text });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Draft failed" },
      { status: 500 }
    );
  }
}
