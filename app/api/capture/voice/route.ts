import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProvisioned } from "@/memory/provisioning";
import { extractCapture } from "@/lib/groq";
import { transcribeAudio, audioFilename } from "@/lib/whisper";

/*
 * Voice capture: transcribe with Whisper, then run the SAME extraction the typed
 * path uses. Returns the transcript + extracted fields so the confirmation card
 * (M05) can show a VOICE chip. Nothing reaches memory until the user confirms.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "No audio received" }, { status: 400 });
  }

  try {
    await ensureProvisioned(user.id);
    const transcript = await transcribeAudio(audio, audioFilename(audio.type));
    if (!transcript) {
      return NextResponse.json({ error: "I couldn't hear anything — try again" }, { status: 422 });
    }

    const extraction = await extractCapture(transcript);

    let candidates: { personId: string; canonicalName: string; cluster: string | null }[] = [];
    if (extraction.name) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("persons")
        .select("person_id, canonical_name, cluster")
        .eq("user_id", user.id)
        .ilike("canonical_name", `%${extraction.name.split(" ")[0]}%`)
        .limit(3);
      candidates = (data ?? []).map((p) => ({
        personId: p.person_id,
        canonicalName: p.canonical_name,
        cluster: p.cluster,
      }));
    }

    return NextResponse.json({ transcript, extraction, candidates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Voice capture failed" },
      { status: 500 }
    );
  }
}
