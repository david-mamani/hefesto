import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProvisioned } from "@/memory/provisioning";
import { remember } from "@/lib/cognee";
import { buildCaptureMarkdown, ONTOLOGY_KEY, type ConfirmedFields } from "@/lib/capture";

type ConfirmBody = {
  resolution: "new" | "existing";
  personId?: string;
  fields: ConfirmedFields;
  sourceText: string;
  channel?: "web" | "telegram";
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as ConfirmBody | null;
  if (!body?.fields?.name?.trim() || !body.sourceText?.trim()) {
    return NextResponse.json({ error: "Invalid confirmation" }, { status: 400 });
  }

  try {
    // Dataset identity ALWAYS derives from the session user — never from the client
    const memory = await ensureProvisioned(user.id);
    const admin = createAdminClient();
    const name = body.fields.name.trim();

    let personId: string;
    let canonicalName: string;

    if (body.resolution === "existing" && body.personId) {
      const { data: person, error } = await admin
        .from("persons")
        .select("person_id, canonical_name")
        .eq("user_id", user.id)
        .eq("person_id", body.personId)
        .single();
      if (error || !person) {
        return NextResponse.json({ error: "Person not found" }, { status: 404 });
      }
      personId = person.person_id;
      canonicalName = person.canonical_name;
    } else {
      canonicalName = name;
      // Same exact name in Cognee merges into one node (deterministic UUID5) —
      // a NEW person with a taken name gets a discriminator in its canonical name
      const { data: clash } = await admin
        .from("persons")
        .select("person_id")
        .eq("user_id", user.id)
        .eq("canonical_name", canonicalName)
        .maybeSingle();
      if (clash) {
        const discriminator =
          body.fields.metAtEvent ?? new Date().toISOString().slice(0, 10);
        canonicalName = `${name} · ${discriminator}`;
      }

      const { data: inserted, error } = await admin
        .from("persons")
        .insert({
          user_id: user.id,
          canonical_name: canonicalName,
          aliases: canonicalName === name ? [] : [name],
          cluster: body.fields.cluster,
          last_interaction: new Date().toISOString(),
        })
        .select("person_id")
        .single();
      if (error || !inserted) {
        return NextResponse.json(
          { error: `Could not register person: ${error?.message}` },
          { status: 500 }
        );
      }
      personId = inserted.person_id;
    }

    const filename = `capture_${randomUUID()}.md`;
    const content = buildCaptureMarkdown({
      canonicalName,
      fields: body.fields,
      sourceText: body.sourceText.trim(),
      channel: body.channel ?? "web",
      capturedAt: new Date(),
    });

    await remember({
      filename,
      content,
      datasetName: memory.datasetName,
      ontologyKey: ONTOLOGY_KEY,
      nodeSet: [body.fields.cluster],
      runInBackground: true,
    });

    await admin
      .from("persons")
      .update({ last_interaction: new Date().toISOString() })
      .eq("person_id", personId);

    return NextResponse.json({ personId, filename, canonicalName });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Capture failed" },
      { status: 500 }
    );
  }
}
